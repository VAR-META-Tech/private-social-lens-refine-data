/**
 * API module for batch refinement
 */
const axios = require('axios');
const { CONFIG } = require('../config/legacy-adapter');
const { logToFile } = require('../logs/logger');

/**
 * Refines a file using the decrypted EEK
 * @param {number} fileId - ID of the file to refine
 * @param {string} dataEncryptionKey - Decrypted Data Encryption Key
 * @returns {object|null} - Result of refinement or null if it failed
 */
const refineFile = async (fileId, dataEncryptionKey) => {
  try {
    const url = `${CONFIG.refinementServiceApiBaseUrl}/refine`;
    console.log(`Refining file ${fileId} with URL: ${url}`);

    // https://docs.pinata.cloud/api-reference/endpoint/ipfs/pin-json-to-ipfs
    const body = {
      file_id: fileId,
      encryption_key: dataEncryptionKey,
      refiner_id: CONFIG.refinerId,
      env_vars: {
        PINATA_API_JWT: CONFIG.pinataApiJwt,
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

    await logToFile("success", fileId, response.data);
    return response.data;
  } catch (error) {
    console.error(
      `Error refining file ${fileId}: ${error.message} ${JSON.stringify(
        error.response?.data
      )}`
    );

    await logToFile("api-error", fileId, error.response?.data || error.message);
    return null;
  }
};

module.exports = {
  refineFile
};