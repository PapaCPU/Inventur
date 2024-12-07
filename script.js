const imageInput = document.getElementById('imageInput');
const processButton = document.getElementById('processButton');
const dataTable = document.getElementById('dataTable');
const statusText = document.getElementById('statusText');

const saveButton = document.getElementById('saveButton');
const downloadButton = document.getElementById('downloadButton');
const clearButton = document.getElementById('clearButton');

processButton.addEventListener('click', handleImage);
saveButton.addEventListener('click', saveData);
downloadButton.addEventListener('click', downloadCSV);
clearButton.addEventListener('click', clearData);

// Beim Laden vorhandene Daten anzeigen
loadDataFromLocalStorage();

async function handleImage() {
  const file = imageInput.files[0];
  if (!file) {
    alert('Bitte zuerst ein Bild auswählen.');
    return;
  }

  statusText.textContent = 'Verarbeite Bild, bitte warten...';

  const reader = new FileReader();
  reader.onload = async () => {
    const imageSrc = reader.result;

    try {
      // OCR ausführen
      const { data: { text } } = await Tesseract.recognize(imageSrc, 'deu');
      console.log('Erkannter Text:', text);

      const artikelnummer = extractArtikelnummer(text);

      if (artikelnummer) {
        addRow(artikelnummer, 0);
        statusText.textContent = 'Artikelnummer erkannt und hinzugefügt.';
      } else {
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
    <td>${artikelnummer}</td>
    <td contenteditable="true">${anzahl}</td>
    <td><button class="button delete-button">Löschen</button></td>
  `;
  dataTable.appendChild(row);

  // Event-Listener für Löschen-Button
  row.querySelector('.delete-button').addEventListener('click', () => {
    dataTable.removeChild(row);
  });
}

function saveData() {
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
