let batchCancelled = false;
let fetchAbort = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFetchSignal() {
  return fetchAbort?.signal;
}

function checkCancelled() {
  if (batchCancelled) {
    const err = new Error("Annulé.");
    err.name = "AbortError";
    throw err;
  }
}

function resetBatchState() {
  batchCancelled = false;
  if (fetchAbort) fetchAbort.abort();
  fetchAbort = new AbortController();
}

function cancelBatch() {
  batchCancelled = true;
  if (fetchAbort) fetchAbort.abort();
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
