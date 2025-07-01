/**
 * External refinement API service
 */
import axios from 'axios';
import { getEnvironmentConfig } from '@/config';
import { container } from '@/core';

/**
 * Refines a file using the decrypted EEK
 * @param fileId - ID of the file to refine
 * @param dataEncryptionKey - Decrypted Data Encryption Key
 * @returns Result of refinement or null if it failed
 */
export async function refineFile(fileId: number, dataEncryptionKey: string): Promise<any | null> {
  try {
    const config = getEnvironmentConfig();
    const url = `${config.refinementServiceApiBaseUrl}/refine`;
    console.log(`Refining file ${fileId} with URL: ${url}`);

    // https://docs.pinata.cloud/api-reference/endpoint/ipfs/pin-json-to-ipfs
    const body = {
      file_id: fileId,
      encryption_key: dataEncryptionKey,
      refiner_id: config.defaultRefinerId,
      env_vars: {
        PINATA_API_JWT: config.pinataApiJwt,
      },
    };

    const headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US",
      Connection: "keep-alive",
      "Content-Type": "application/json",
    };

    const response = await axios.post(url, body, { headers });
    console.log(`Successfully refined file ${fileId}`);

    // Log success using new logging service
    try {
      const loggingService = container.getLoggingService();
      loggingService.info('File refinement successful', {
        fileId,
        operation: 'refineFile',
        metadata: response.data
      }, 'api');
    } catch (logError) {
      console.error('Failed to log refinement success:', logError);
    }

    return response.data;
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const responseData = error?.response?.data;

    console.error(
      `Error refining file ${fileId}: ${errorMessage} ${JSON.stringify(responseData)}`
    );

    // Log error using new logging service
    try {
      const loggingService = container.getLoggingService();
      loggingService.error('File refinement failed', error, {
        fileId,
        operation: 'refineFile',
        metadata: responseData
      }, 'api');
    } catch (logError) {
      console.error('Failed to log refinement error:', logError);
    }

    return null;
  }
} 