
// ==========================================
// ÑAPPIX - FUNCIONES PRINCIPALES
// ==========================================

// Elementos del conversor
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileSelected = document.getElementById('fileSelected');
const convertForm = document.getElementById('convertForm');
const convertButton = document.getElementById('convertButton');
const formMessage = document.getElementById('formMessage');
const formatSelect = document.getElementById('formatSelect');

let selectedFile = null;

// Año automático
const yearElement = document.getElementById('year');

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

// ==========================================
// MENÚ PARA CELULARES
// ==========================================

const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute(
      'aria-label',
      isOpen ? 'Cerrar menú' : 'Abrir menú'
    );
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Abrir menú');
    });
  });
}

// ==========================================
// BUSCADOR DE HERRAMIENTAS
// ==========================================

const toolSearch = document.getElementById('toolSearch');
const categoryCards = document.querySelectorAll('.category-card');

if (toolSearch) {
  toolSearch.addEventListener('input', () => {
    const search = toolSearch.value.trim().toLowerCase();

    categoryCards.forEach(card => {
      const content = (
        card.innerText + ' ' + (card.dataset.search || '')
      ).toLowerCase();

      card.style.display = content.includes(search) ? '' : 'none';
    });
  });
}

// ==========================================
// SELECCIÓN DE ARCHIVOS
// ==========================================

function selectFile(file) {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  selectedFile = null;

  if (!file) return;

  if (!allowedTypes.includes(file.type)) {
    if (fileSelected) fileSelected.textContent = '';

    if (formMessage) {
      formMessage.textContent =
        'Formato no permitido. Selecciona JPG, PNG o WEBP.';
    }

    return;
  }

  if (file.size > 15 * 1024 * 1024) {
    if (fileSelected) fileSelected.textContent = '';

    if (formMessage) {
      formMessage.textContent =
        'La imagen supera el límite permitido de 15 MB.';
    }

    return;
  }

  selectedFile = file;

  if (fileSelected) {
    fileSelected.textContent =
      '✓ ' + file.name + ' (' +
      (file.size / 1024 / 1024).toFixed(2) + ' MB)';
  }

  if (formMessage) {
    formMessage.textContent = '';
  }
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length) {
      selectFile(fileInput.files[0]);
    }
  });
}

// ==========================================
// ARRASTRAR Y SOLTAR
// ==========================================

if (uploadArea) {
  uploadArea.addEventListener('dragover', event => {
    event.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', event => {
    if (!uploadArea.contains(event.relatedTarget)) {
      uploadArea.classList.remove('dragover');
    }
  });

  uploadArea.addEventListener('drop', event => {
    event.preventDefault();
    uploadArea.classList.remove('dragover');

    const file = event.dataTransfer.files[0];

    if (file) {
      selectFile(file);
    }
  });
}

// ==========================================
// CONVERSIÓN DE IMÁGENES
// ==========================================

if (convertForm) {
  convertForm.addEventListener('submit', async event => {
    event.preventDefault();

    if (!selectedFile) {
      formMessage.textContent =
        'Primero selecciona una imagen.';
      return;
    }

    const format = formatSelect.value;

    const currentFormat = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    }[selectedFile.type];

    if (format === currentFormat) {
      formMessage.textContent =
        'La imagen ya está en ese formato.';
      return;
    }

    const formData = new FormData();

    formData.append('file', selectedFile);
    formData.append('format', format);

    convertButton.disabled = true;
    convertButton.textContent = 'Convirtiendo...';

    formMessage.textContent =
      'Estamos preparando tu imagen.';

    try {
      const response = await fetch('/api/convert/image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMessage =
          'No se pudo convertir la imagen.';

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {}

        throw new Error(errorMessage);
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      const originalName = selectedFile.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');

      const extension = format === 'jpg' ? 'jpg' : format;

      const downloadName =
        (originalName || 'imagen') + '.' + extension;

      const link = document.createElement('a');

      link.href = url;
      link.download = downloadName;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1500);

      formMessage.textContent =
        '¡Conversión completada! Tu descarga está lista.';

    } catch (error) {
      console.error('Error de conversión:', error);

      formMessage.textContent =
        error.message || 'Ocurrió un error al convertir la imagen.';

    } finally {
      convertButton.disabled = false;
      convertButton.innerHTML =
        'Convertir imagen <span>→</span>';
    }
  });
}

// ==========================================
// ESTADO DEL SERVIDOR
// ==========================================

async function checkServer() {
  try {
    const response = await fetch('/api/health');

    if (!response.ok) {
      throw new Error('Servidor no disponible');
    }

    console.log('ÑAPPIX: servidor conectado correctamente.');

  } catch (error) {
    console.warn('ÑAPPIX: no se pudo comprobar el servidor.');
  }
}

checkServer();
