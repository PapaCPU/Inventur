const imageInput = document.getElementById('imageInput');
const processButton = document.getElementById('processButton');
const dataTable = document.getElementById('dataTable');
const statusText = document.getElementById('statusText');

const saveButton = document.getElementById('saveButton');
const downloadButton = document.getElementById('downloadButton');
const clearButton = document.getElementById('clearButton');

const ocrResultSection = document.getElementById('ocr-result-section');
const recognizedNumberEl = document.getElementById('recognizedNumber');
const confirmButton = document.getElementById('confirmButton');
const discardButton = document.getElementById('discardButton');

let currentRecognizedNumber = null; // Speichert temporär die erkannte Artikelnummer

processButton.addEventListener('click', handleImage);
saveButton.addEventListener('click', saveData);
downloadButton.addEventListener('click', downloadCSV);
clearButton.addEventListener('click', clearData);

confirmButton.addEventListener('click', confirmRecognition);
discardButton.addEventListener('click', discardRecognition);

// Beim Laden vorhandene Daten anzeigen
loadDataFromLocalStorage();

// Validierung beim Focus-Verlust in der Tabelle
dataTable.addEventListener('focusout', (e) => {
  if (e.target && e.target.closest('tr')) {
    validateRow(e.target.closest('tr'));
  }
});

async function handleImage() {
  const file = imageInput.files[0];
  if (!file) {
    alert('Bitte zuerst ein Bild auswählen oder aufnehmen.');
    return;
  }

  statusText.textContent = 'Verarbeite Bild, bitte warten...';

  const reader = new FileReader();
  reader.onload = async () => {
    const imageSrc = reader.result;

    try {
      const processedDataURL = await preprocessImage(imageSrc);

      // OCR ausführen
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
  };

  reader.readAsDataURL(file);
}

function extractArtikelnummer(text) {
  // Regex für Format: 6 Ziffern, Bindestrich, 6 Ziffern
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

  // Event-Listener für Löschen-Button
  row.querySelector('.delete-button').addEventListener('click', () => {
    dataTable.removeChild(row);
  });

  // Direkt validieren
  validateRow(row);
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

function confirmRecognition() {
  if (currentRecognizedNumber) {
    addRow(currentRecognizedNumber, 0);
  }
  // Danach das Result-Feld ausblenden und Variablen zurücksetzen
  ocrResultSection.style.display = 'none';
  currentRecognizedNumber = null;
  statusText.textContent = '';
}

function discardRecognition() {
  // Abbrechen, nichts hinzufügen
  ocrResultSection.style.display = 'none';
  currentRecognizedNumber = null;
  statusText.textContent = '';
}

// Validierung der Artikelnummern
function validateRow(row) {
  const artikelnummer = row.children[0].textContent.trim();
  const artikelValid = /\b\d{6}-\d{6}\b/.test(artikelnummer);

  if (!artikelValid) {
    row.children[0].classList.add('invalid');
  } else {
    row.children[0].classList.remove('invalid');
  }
}

// Einfache Bildvorverarbeitung (Grayscale + Thresholding + Skalierung)
async function preprocessImage(dataURL) {
  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');

      // Skalierung auf Breite 800px für bessere Performance (anpassbar)
      const scale = 800 / img.width;
      const newWidth = 800;
      const newHeight = img.height * scale;

      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Pixel auslesen
      const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
      const data = imageData.data;

      // Graustufen + einfaches Thresholding
      // Threshold = 128 als Beispiel
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
