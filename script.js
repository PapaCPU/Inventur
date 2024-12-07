const video = document.getElementById('video');
const captureButton = document.getElementById('captureButton');
const statusText = document.getElementById('statusText');
const dataTable = document.getElementById('dataTable');
const ocrResultSection = document.getElementById('ocr-result-section');
const recognizedNumberEl = document.getElementById('recognizedNumber');
const confirmButton = document.getElementById('confirmButton');
const discardButton = document.getElementById('discardButton');

const saveButton = document.getElementById('saveButton');
const downloadButton = document.getElementById('downloadButton');
const clearButton = document.getElementById('clearButton');

let currentRecognizedNumber = null;

// Kamera-Starten
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
  .then(stream => {
    video.srcObject = stream;
    video.play();
  })
  .catch(err => {
    console.error("Kamerazugriff verweigert oder nicht möglich:", err);
    alert("Kamera kann nicht gestartet werden.");
  });

captureButton.addEventListener('click', captureFrame);
confirmButton.addEventListener('click', confirmRecognition);
discardButton.addEventListener('click', discardRecognition);

saveButton.addEventListener('click', saveData);
downloadButton.addEventListener('click', downloadCSV);
clearButton.addEventListener('click', clearData);

dataTable.addEventListener('focusout', (e) => {
  if (e.target && e.target.closest('tr')) {
    validateRow(e.target.closest('tr'));
  }
});

loadDataFromLocalStorage();

async function captureFrame() {
  statusText.textContent = 'Verarbeite Bild...';

  // Canvas erstellen für Snapshot
  const canvas = document.createElement('canvas');
  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  // Aktuellen Frame zeichnen
  ctx.drawImage(video, 0, 0, w, h);

  // Jetzt den Bereich aus dem Overlay ausschneiden
  // Overlay ist 200x100 Pixel in der Mitte des Videos
  // Berechnen der Positionen: 
  // Der Overlay Frame ist in der Mitte, wir gehen davon aus:
  const frameWidth = 200;
  const frameHeight = 100;
  const centerX = w / 2;
  const centerY = h / 2;
  const startX = centerX - frameWidth / 2;
  const startY = centerY - frameHeight / 2;

  const frameData = ctx.getImageData(startX, startY, frameWidth, frameHeight);

  // Neues Canvas für den Ausschnitt
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = frameWidth;
  frameCanvas.height = frameHeight;
  const frameCtx = frameCanvas.getContext('2d');
  frameCtx.putImageData(frameData, 0, 0);

  // Preprocessing (optional)
  const processedDataURL = await preprocessImage(frameCanvas.toDataURL('image/png'));

  try {
    const { data: { text } } = await Tesseract.recognize(processedDataURL, 'deu');
    console.log('Erkannter Text:', text);

    const artikelnummer = extractArtikelnummer(text);
    if (artikelnummer) {
      currentRecognizedNumber = artikelnummer;
      recognizedNumberEl.textContent = artikelnummer;
      ocrResultSection.style.display = 'block';
      statusText.textContent = 'Artikelnummer erkannt. Bitte bestätigen oder verwerfen.';
    } else {
      currentRecognizedNumber = null;
      ocrResultSection.style.display = 'none';
      statusText.textContent = 'Keine gültige Artikelnummer im Format 123456-123456 gefunden.';
    }
  } catch (error) {
    console.error('Fehler bei der Texterkennung:', error);
    statusText.textContent = 'Fehler bei der Texterkennung. Siehe Konsole.';
  }
}

function extractArtikelnummer(text) {
  const match = text.match(/\b\d{6}-\d{6}\b/);
  return match ? match[0] : null;
}

function addRow(artikelnummer, anzahl) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td contenteditable="true">${artikelnummer}</td>
    <td contenteditable="true">${anzahl}</td>
    <td><button class="button delete-button">Löschen</button></td>
  `;
  dataTable.appendChild(row);

  row.querySelector('.delete-button').addEventListener('click', () => {
    dataTable.removeChild(row);
  });

  validateRow(row);
}

function confirmRecognition() {
  if (currentRecognizedNumber) {
    addRow(currentRecognizedNumber, 0);
  }
  ocrResultSection.style.display = 'none';
  currentRecognizedNumber = null;
  statusText.textContent = '';
}

function discardRecognition() {
  ocrResultSection.style.display = 'none';
  currentRecognizedNumber = null;
  statusText.textContent = '';
}

function saveData() {
  if (!confirm('Daten jetzt wirklich speichern?')) {
    return;
  }

  const data = [];
  dataTable.querySelectorAll('tr').forEach(row => {
    const artikelnummer = row.children[0].textContent.trim();
    const anzahl = row.children[1].textContent.trim();
    if (artikelnummer && anzahl) {
      data.push({ artikelnummer, anzahl });
    }
  });

  localStorage.setItem('inventurData', JSON.stringify(data));
  alert('Daten gespeichert!');
}

function loadDataFromLocalStorage() {
  const storedData = JSON.parse(localStorage.getItem('inventurData') || '[]');
  storedData.forEach(entry => {
    addRow(entry.artikelnummer, entry.anzahl);
  });
}

function downloadCSV() {
  const data = JSON.parse(localStorage.getItem('inventurData') || '[]');
  if (data.length === 0) {
    alert('Keine Daten vorhanden.');
    return;
  }

  const csvContent = "data:text/csv;charset=utf-8," +
    "Artikelnummer,Anzahl\n" +
    data.map(e => `${e.artikelnummer},${e.anzahl}`).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "inventur.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function clearData() {
  if (confirm('Alle Daten löschen?')) {
    localStorage.removeItem('inventurData');
    dataTable.innerHTML = '';
    alert('Daten gelöscht!');
  }
}

function validateRow(row) {
  const artikelnummer = row.children[0].textContent.trim();
  const artikelValid = /\b\d{6}-\d{6}\b/.test(artikelnummer);

  if (!artikelValid) {
    row.children[0].classList.add('invalid');
  } else {
    row.children[0].classList.remove('invalid');
  }
}

// Einfache Bildvorverarbeitung
async function preprocessImage(dataURL) {
  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');

      // Skalierung auf kleinere Größe für OCR
      const scale = 2; // einfaches Beispiel: 2x vergrößern oder anpassen
      const newWidth = img.width * scale;
      const newHeight = img.height * scale;

      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
      const data = imageData.data;

      // Graustufen & Threshold
      const threshold = 128;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const grayscale = 0.3*r + 0.59*g + 0.11*b;
        const val = grayscale < threshold ? 0 : 255;
        data[i] = val;
        data[i+1] = val;
        data[i+2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataURL;
  });
}
