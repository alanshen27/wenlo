document.getElementById("save").addEventListener("click", async () => {
  const baseUrl = document.getElementById("baseUrl").value.trim().replace(/\/$/, "");
  const apiKey = document.getElementById("apiKey").value.trim();
  const libraryId = document.getElementById("libraryId").value.trim();
  await chrome.storage.sync.set({ baseUrl, apiKey, libraryId });
  document.getElementById("status").textContent = "Saved.";
});

chrome.storage.sync.get(["baseUrl", "apiKey", "libraryId"], (data) => {
  if (data.baseUrl) document.getElementById("baseUrl").value = data.baseUrl;
  if (data.apiKey) document.getElementById("apiKey").value = data.apiKey;
  if (data.libraryId) document.getElementById("libraryId").value = data.libraryId;
});
