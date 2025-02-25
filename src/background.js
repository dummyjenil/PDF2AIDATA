'use strict';

chrome.action.onClicked.addListener((tab) => {
  chrome.windows.create({
    url: "popup.html",
    type: "popup",
    width: 600,
    height: 600
  });
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openWindow") {
    chrome.windows.create({
      url: "https://www.google.com",
      type: "popup",
      width: 800,
      height: 600
    }, (newWindow) => {
      if (newWindow.tabs && newWindow.tabs[0]) {
        let tabId = newWindow.tabs[0].id;
        chrome.tabs.onUpdated.addListener(function listener(tabIdUpdated, changeInfo) {
          if (tabIdUpdated === tabId && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener); // Remove listener
            sendResponse({ winId: newWindow.id, tabId: tabId });
          }
        });
      }
    });
  }
  
  if (request.action === "closeWindow" && request.id) {
    chrome.windows.remove(request.id, () => {
      sendResponse({});
    });
  }

  if (request.action === "executeScriptWindow" && request.id && request.imgblob) {
    chrome.windows.getAll({ populate: true }, (windows) => {
      const tabId = windows.find(win => win.id === request.id).tabs[0].id;
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (base64String) => {
          const byteCharacters = atob(base64String.split(",")[1]); // Decode Base64 (remove metadata)
          const byteArrays = [];
          for (let i = 0; i < byteCharacters.length; i += 512) {
            const slice = byteCharacters.slice(i, i + 512);
            const byteNumbers = new Array(slice.length);
            for (let j = 0; j < slice.length; j++) {
              byteNumbers[j] = slice.charCodeAt(j);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
          }
          const blob = new Blob(byteArrays, { type: "image/png" });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(new File([blob], "image.png", { type: blob.type }));
          document.querySelector('[aria-label="Search by image"]').click();
          new Promise(resolve => setTimeout(resolve, 1000)).then(() => {
            const fileInput = document.querySelector('input[type="file"]');
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          });
        },
        args: [request.imgblob]
      }, () => {
        chrome.tabs.onUpdated.addListener(function listener(tabIdUpdated, changeInfo) {
          if (tabIdUpdated === tabId && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener); // Remove listener
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: () => {
                function getvaluebycalc(style) {
                  const match = style.match(/([-+]?[0-9]*\.?[0-9]+)(?=%)/);
                  return match ? parseFloat(match[1]) : null;
                }
                function getvaluebydeg(style) {
                  const match = style.match(/([-+]?[0-9]*\.?[0-9]+)(?=deg)/);
                  return match ? parseFloat(match[1]) : null;
                }

                function getConfig(element) {
                  let imgConfig = {};
                  if (element.hasAttribute('data-use-native-focus-logic')) { return; }
                  else if (element.hasAttribute('tabindex')) { }
                  else if (element.hasAttribute("aria-label")) {
                    imgConfig["word"] = element.getAttribute("aria-label");
                  } else { return; }
                  let style = element.getAttribute("style");
                  if (style) {
                    imgConfig["top"] = getvaluebycalc(element.style.top)
                    imgConfig["left"] = getvaluebycalc(element.style.left)
                    imgConfig["width"] = getvaluebycalc(element.style.width)
                    imgConfig["height"] = getvaluebycalc(element.style.height)
                    imgConfig['rotation'] = getvaluebydeg(element.style.transform)
                  }
                  return imgConfig;
                }

                let imgdata = []
                document.querySelector("[data-capture-text-selection='true']").querySelectorAll("*").forEach(element => {
                  conf = getConfig(element)
                  if (conf) {
                    imgdata.push(conf)
                  }
                });
                return imgdata;
              }
            }, (res) => {
              sendResponse({ result: res[0].result });
            })
          }
        });
      });
    });
  }

  if (request.action === "request" && request.text) {
    async function translateText(text, sourceLang = "auto", targetLang = "en") {
      const url = "https://translate.googleapis.com/translate_a/single";
      const params = new URLSearchParams({
        client: "gtx",
        dt: "t",
        sl: sourceLang,
        tl: targetLang,
        q: text
      });
      const response = await fetch(`${url}?${params.toString()}`);
      let json_data = await response.json();
      let return_data = json_data[0].map(i => ({
        translated: i[0].trim(),
        orig: i[1].trim()
      }));
      return return_data;
    }
    translateText(request.text).then((res) => {
      sendResponse({ result: res });
    })
  }

  return true;
});
