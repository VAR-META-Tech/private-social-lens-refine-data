/**
 * Blockchain interaction service for smart contracts
 */
import { ethers } from 'ethers';
import { getEnvironmentConfig } from '@/config';
import { logger, LogContext } from './logging.service';

// Import eccrypto as any to avoid type issues
const eccrypto = require('eccrypto');

// Provider instance
let provider: ethers.providers.JsonRpcProvider;
let isInitialized = false;

/**
 * Initializes the Ethereum contract connection
 */
export function initializeContract(): void {
  const config = getEnvironmentConfig();

  if (!config.dataRegistryAddress) {
    throw new Error("DATA_REGISTRY_ADDRESS environment variable must be set");
  }

  // Create a provider with network information and ENS disabled
  const network = {
    name: 'vana-moksha',
    chainId: 14800, // TODO - NEED TO FIX HARDCODING
  };

  provider = new ethers.providers.JsonRpcProvider(config.rpcUrl, network);
  isInitialized = true;

  const logContext: LogContext = {
    operation: 'blockchain-init'
  };

  logger.info(`Connected to DataRegistry contract at ${config.dataRegistryAddress}`, logContext, 'Blockchain');
}

/**
 * Ensures the contract is initialized
 */
function ensureInitialized(): void {
  if (!isInitialized || !provider) {
    initializeContract();
  }
}

/**
 * Retrieves the file ID stored at a given index in the registry
 */
export async function getFileAtIndex(index: number | ethers.BigNumber): Promise<ethers.BigNumber | null> {
  ensureInitialized();

  try {
    const config = getEnvironmentConfig();
    const iface = new ethers.utils.Interface([
      "function filesListAt(uint256 index) view returns (uint256)",
    ]);
    const data = iface.encodeFunctionData("filesListAt", [index]);
    const result = await provider.call({
      to: config.dlpAddress,
      data,
    });

    if (result && result !== "0x") {
      const [fileId] = iface.decodeFunctionResult("filesListAt", result);
      return fileId as ethers.BigNumber;
    }
    return null;
  } catch (error: any) {
    console.error(`Error fetching file at index ${index}: ${error?.message || error}`);
    return null;
  }
}

/**
 * Decrypts the Encrypted Encryption Key (EEK) using the DLP Private Key
 */
export async function decryptEEK(encryptedEEK: string, fileId?: number): Promise<string | null> {
  try {
    const config = getEnvironmentConfig();
    const privateKeyBuffer = Buffer.from(
      config.dlpPrivateKey.startsWith("0x")
        ? config.dlpPrivateKey.slice(2)
        : config.dlpPrivateKey,
      "hex"
    );

    // Split encryptedHex into components
    const encryptedBuffer = Buffer.from(encryptedEEK, "hex");
    const iv = encryptedBuffer.slice(0, 16);
    const ephemPublicKey = encryptedBuffer.slice(16, 81);
    const ciphertext = encryptedBuffer.slice(81, encryptedBuffer.length - 32);
    const mac = encryptedBuffer.slice(encryptedBuffer.length - 32);

    const decryptedBuffer = await eccrypto.decrypt(privateKeyBuffer, {
      iv,
      ephemPublicKey,
      ciphertext,
      mac,
    });

    return decryptedBuffer.toString();
  } catch (error: any) {
    console.error(`decryptEEK error for EEK: ${error?.message || error}`);
    return null;
  }
}

/**
 * Checks file permissions and gets the EEK from the DataRegistry contract
 */
export async function getFilePermissions(fileId: number): Promise<string | null> {
  ensureInitialized();

  try {
    const config = getEnvironmentConfig();
    logger.info(
      `Checking file permissions for ID: ${fileId} with address: ${config.dlpAddress}`
    );

    // Create a contract interface manually
    const iface = new ethers.utils.Interface([
      "function filePermissions(uint256 fileId, address dlpAddress) view returns (string)",
    ]);

    // Encode the function call data manually to avoid ENS resolution
    const data = iface.encodeFunctionData("filePermissions", [
      fileId,
      config.dlpAddress,
    ]);

    // Make a raw call to the contract
    logger.info(`Making raw call to contract ${config.dataRegistryAddress}`);
    const result = await provider.call({
      to: config.dataRegistryAddress,
      data,
    });

    logger.info(`Got raw result: ${result.slice(0, 50)}...`);

    // If we got a result, decode it
    if (result && result !== "0x") {
      try {
        const decoded = iface.decodeFunctionResult("filePermissions", result);
        logger.info('Successfully decoded result');

        if (decoded && decoded[0] && decoded[0] !== "") {
          logger.info(`Found EEK for file ${fileId}`);
          return decoded[0] as string;
        }
      } catch (decodeError: any) {
        console.error(`Error decoding result: ${decodeError?.message || decodeError}`);
      }
    }

    logger.info(`No EEK found for file ${fileId}`);
    return null;
  } catch (error: any) {
    console.error(
      `Error checking permissions for file ${fileId} from contract: ${error?.message || error}`
    );

    // Print more error details if available
    if (error?.code) console.error(`Error code: ${error.code}`);
    if (error?.reason) console.error(`Error reason: ${error.reason}`);
    if (error?.data) console.error(`Error data: ${error.data}`);

    return null;
  }
}

/**
 * Checks if a file has already been refined by a specific refiner
 */
export async function checkFileRefinement(fileId: number, refinerId?: number): Promise<boolean> {
  ensureInitialized();

  try {
    const config = getEnvironmentConfig();
    const actualRefinerId = refinerId || config.defaultRefinerId;

    logger.info(
      `Checking if file ${fileId} has been refined by refiner ${actualRefinerId}`
    );

    // Create a contract interface manually
    const iface = new ethers.utils.Interface([
      "function fileRefinements(uint256 fileId, uint256 refinerId) view returns (string)",
    ]);

    // Encode the function call data manually to avoid ENS resolution
    const data = iface.encodeFunctionData("fileRefinements", [
      fileId,
      actualRefinerId,
    ]);

    // Make a raw call to the contract
    logger.info(`Making raw call to contract ${config.dataRegistryAddress}`);
    const result = await provider.call({
      to: config.dataRegistryAddress,
      data,
    });

    logger.info(`Got raw result: ${result.slice(0, 50)}...`);

    // If we got a result, decode it
    if (result && result !== "0x") {
      try {
        const decoded = iface.decodeFunctionResult("fileRefinements", result);
        logger.info('Successfully decoded result');

        if (decoded && decoded[0] && decoded[0] !== "") {
          logger.info(`File ${fileId} has already been refined by refiner ${actualRefinerId}`);
          return true;
        }
      } catch (decodeError: any) {
        console.error(`Error decoding refinement check result: ${decodeError?.message || decodeError}`);
      }
    }

    logger.info(`File ${fileId} has not been refined by refiner ${actualRefinerId}`);
    return false;
  } catch (error: any) {
    console.error(
      `Error checking refinement for file ${fileId}: ${error?.message || error}`
    );

    return false;
  }
}

/**
 * Get the current provider instance
 */
export function getProvider(): ethers.providers.JsonRpcProvider {
  ensureInitialized();
  return provider;
}

/**
 * Check if the contract is initialized
 */
export function isContractInitialized(): boolean {
  return isInitialized && !!provider;
}
