
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileSelected = document.getElementById('fileSelected');
const convertForm = document.getElementById('convertForm');
const convertButton = document.getElementById('convertButton');
const formMessage = document.getElementById('formMessage');
const formatSelect = document.getElementById('formatSelect');

let selectedFile = null;

document.getElementById('year').textContent = new Date().getFullYear();

// Menú para celulares
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');

menuToggle.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
  });
});

// Buscador de herramientas
const toolSearch = document.getElementById('toolSearch');
const categoryCards = document.querySelectorAll('.category-card');

toolSearch.addEventListener('input', () => {
  const search = toolSearch.value.trim().toLowerCase();

  categoryCards.forEach(card => {
    const content = (
      card.innerText + ' ' + (card.dataset.search || '')
    ).toLowerCase();

    card.style.display = content.includes(search) ? '' : 'none';
  });
});

// Seleccionar archivo
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) {
    selectFile(fileInput.files[0]);
  }
});

function selectFile(file) {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  selectedFile = null;
  fileInput.value = '';

  if (!allowedTypes.includes(file.type)) {
    fileSelected.textContent = '';
    formMessage.textContent = 'Selecciona una imagen JPG, PNG o WEBP.';
    return;
  }

  if (file.size > 15 * 1024 * 1024) {
    fileSelected.textContent = '';
    formMessage.textContent = 'La imagen supera el límite de 15 MB.';
    return;
  }

  selectedFile = file;
  fileSelected.textContent =
    '✓ ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)';

  formMessage.textContent = '';
}

// Arrastrar y soltar
uploadArea.addEventListener('dragover', event => {
  event.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', event => {
  event.preventDefault();
  uploadArea.classList.remove('dragover');

  const file = event.dataTransfer.files[0];

  if (file) {
    selectFile(file);
  }
});

// Conversión de imágenes
convertForm.addEventListener('submit', async event => {
  event.preventDefault();

  if (!selectedFile) {
    formMessage.textContent = 'Primero selecciona una imagen.';
    return;
  }

  const format = formatSelect.value;

  if (
    format === 'jpg' &&
    selectedFile.type === 'image/jpeg' ||
    format === 'png' &&
    selectedFile.type === 'image/png' ||
    format === 'webp' &&
    selectedFile.type === 'image/webp'
  ) {
    formMessage.textContent = 'La imagen ya está en ese formato.';
    return;
  }

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('format', format);

  convertButton.disabled = true;
  convertButton.textContent = 'Convirtiendo...';
  formMessage.textContent = 'Estamos preparando tu imagen.';

  try {
    const response = await fetch('/api/convert/image', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      let errorMessage = 'No se pudo convertir la imagen.';

      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {}

      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const extension = format === 'jpg' ? 'jpg' : format;
    const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
    const downloadName = originalName + '.' + extension;

    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    formMessage.textContent = '¡Conversión completada! Tu descarga está lista.';
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    convertButton.disabled = false;
    convertButton.innerHTML = 'Convertir imagen <span>→</span>';
  }
});
