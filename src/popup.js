'use strict';

import './popup.css';

(() => {
  /**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        resolve(reader.result);
      };
    });
  }

  /**
 * @param {Event} event
 */
  function onpdfupload(event) {
    const file = event.target.files[0];
    if (!file) return;
    let json_data = [];
    const reader = new FileReader();
    const filename = /** @type {String} */ (file.name);
    document.getElementById("fileName").innerHTML = filename;
    reader.readAsArrayBuffer(file);
    reader.onload = () => {
      const pdfData = new Uint8Array(reader.result);
      // Load PDF
      pdfjsLib.getDocument({ data: pdfData }).promise.then((pdf) => {
        // Open window
        chrome.runtime.sendMessage({ action: "openWindow" }, (response) => {
          let WinId = response.winId;
          const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("pdfCanvas"));
          const context = canvas.getContext("2d");
          const totalPages = pdf.numPages;
          const completedpages_html = document.getElementById("completedpages")
          const ProgBar = document.getElementById("ProgBar");
          document.getElementById("allpages").innerHTML = totalPages;
          completedpages_html.innerHTML = "0";
          /**
           * @param {number} pageNum
           */
          function renderPage(pageNum = 1) {
            if (pageNum > totalPages) {
              chrome.runtime.sendMessage({ action: "closeWindow", id: WinId }, () => {
                const jsonString = JSON.stringify(json_data, null, 2); // Pretty format JSON
                const url = URL.createObjectURL(new Blob([jsonString], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = filename.replace(/\.pdf$/, '.json');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              });
              return;
            }
            pdf.getPage(pageNum).then((page) => {
              const scale = 2; // quality
              const viewport = page.getViewport({ scale });
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              page.render({ canvasContext: context, viewport }).promise.then(() => {
                canvas.toBlob((blob) => {
                  blobToBase64(blob).then((base64String) => {
                    canvas.height = 0;
                    canvas.width = 0;
                    chrome.runtime.sendMessage({ action: "executeScriptWindow", id: WinId, imgblob: base64String }, (response) => {
                      let metadata = response.result;
                      let maintext = /** @type {String} */ (metadata.map(i => i.word ? i.word + " " : "\n").join("").trim());
                      chrome.runtime.sendMessage({ action: "request", text: maintext }, (transresponse) => {
                        /**
                         * @typedef {Object} Translation
                         * @property {string} translated
                         * @property {string} orig
                         */
                        /**
                         * @type {Translation[]} 
                         */
                        let translate_metadata = transresponse.result
                        json_data.push({
                          metadata: JSON.stringify(metadata),
                          maintext: maintext,
                          text: /** @type {String} */ (translate_metadata.map(item => item.translated).join("")),
                          translate_metadata: translate_metadata
                        })
                        ProgBar.style.width = (pageNum/totalPages)*100+"%"
                        completedpages_html.innerHTML = pageNum.toString();
                        renderPage(pageNum + 1);
                      });
                    });
                  })
                }, "image/png");
              });
            });
          }
          renderPage();
        });
      });
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('UploadBtn').addEventListener("click", () => {
      document.getElementById("UploadPdf").click();
    })

    document.getElementById('UploadPdf').addEventListener('change', onpdfupload);

  });
})();
