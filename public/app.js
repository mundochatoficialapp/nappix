
document.addEventListener('DOMContentLoaded', () => {

  // AÑO DEL FOOTER
  const year = document.getElementById('year');

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // MENÚ PARA CELULARES
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');

  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('open');
      menuToggle.textContent = mainNav.classList.contains('open') ? '✕' : '☰';
    });

    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        menuToggle.textContent = '☰';
      });
    });
  }

  // CAMBIAR ENTRE HERRAMIENTAS
  const tabs = document.querySelectorAll('.tool-tab');
  const panels = document.querySelectorAll('.tool-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const selectedTool = tab.dataset.tool;

      tabs.forEach(item => item.classList.remove('active'));
      panels.forEach(panel => panel.classList.remove('active'));

      tab.classList.add('active');

      const selectedPanel = document.getElementById(`panel-${selectedTool}`);

      if (selectedPanel) {
        selectedPanel.classList.add('active');
      }
    });
  });

  // FORMATO DE TAMAÑOS
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} bytes`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // SELECCIÓN DE ARCHIVOS
  const fileInputs = [
    { input: 'convertFile', output: 'convertFileName', type: 'image' },
    { input: 'compressFile', output: 'compressFileName', type: 'image' },
    { input: 'resizeFile', output: 'resizeFileName', type: 'image' },
    { input: 'pdfWordFile', output: 'pdfWordFileName', type: 'pdf' },
    { input: 'mergeFiles', output: 'mergeFileName', type: 'pdf', multiple: true },
    { input: 'splitFile', output: 'splitFileName', type: 'pdf' }
  ];

  fileInputs.forEach(config => {
    const input = document.getElementById(config.input);
    const output = document.getElementById(config.output);

    if (!input || !output) return;

    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);

      if (files.length === 0) {
        output.textContent = 'Ningún archivo seleccionado';
        return;
      }

      const maxSize = config.type === 'pdf'
        ? 25 * 1024 * 1024
        : 15 * 1024 * 1024;

      const allowedType = config.type === 'pdf'
        ? file => file.type === 'application/pdf'
        : file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);

      const invalidFile = files.find(file =>
        !allowedType(file) || file.size > maxSize
      );

      if (invalidFile) {
        alert(
          `El archivo "${invalidFile.name}" no es válido o supera el límite permitido de ${config.type === 'pdf' ? '25 MB' : '15 MB'}.`
        );

        input.value = '';
        output.textContent = 'Ningún archivo seleccionado';
        return;
      }

      if (config.multiple) {
        if (files.length < 2 || files.length > 10) {
          alert('Selecciona entre 2 y 10 archivos PDF.');
          input.value = '';
          output.textContent = 'Ningún archivo seleccionado';
          return;
        }

        const totalSize = files.reduce((sum, file) => sum + file.size, 0);

        output.textContent =
          `${files.length} archivos seleccionados · ${formatBytes(totalSize)}`;
      } else {
        output.textContent =
          `${files[0].name} · ${formatBytes(files[0].size)}`;
      }
    });
  });

  // DESCARGAR ARCHIVOS PROCESADOS
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // OBTENER NOMBRE DEL ARCHIVO
  function getFilename(response, fallback) {
    const disposition = response.headers.get('Content-Disposition');

    if (!disposition) return fallback;

    const match = disposition.match(/filename="?([^";]+)"?/i);

    return match ? match[1] : fallback;
  }

  // PROCESAR FORMULARIOS
  const forms = [
    {
      id: 'convertForm',
      message: 'convertMessage',
      fallback: 'nappix-convertida.png',
      success: '¡Imagen convertida correctamente!'
    },
    {
      id: 'compressForm',
      message: 'compressMessage',
      fallback: 'nappix-comprimida.jpg',
      success: '¡Imagen comprimida correctamente!'
    },
    {
      id: 'resizeForm',
      message: 'resizeMessage',
      fallback: 'nappix-redimensionada.jpg',
      success: '¡Imagen redimensionada correctamente!'
    },
    {
      id: 'pdfWordForm',
      message: 'pdfWordMessage',
      fallback: 'nappix-convertido.docx',
      success: '¡Tu documento Word está listo para descargar!'
    },
    {
      id: 'mergeForm',
      message: 'mergeMessage',
      fallback: 'nappix-pdf-unido.pdf',
      success: '¡Tus archivos PDF se han unido correctamente!'
    },
    {
      id: 'splitForm',
      message: 'splitMessage',
      fallback: 'nappix-pdf-dividido.pdf',
      success: '¡Tu PDF se ha dividido correctamente!'
    }
  ];

  forms.forEach(config => {
    const form = document.getElementById(config.id);
    const message = document.getElementById(config.message);

    if (!form || !message) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      const button = form.querySelector('button[type="submit"]');

      const originalText = button
        ? button.textContent
        : 'Procesar';

      message.textContent = 'Procesando tu archivo...';
      message.className = 'form-message';

      if (button) {
        button.disabled = true;
        button.textContent = 'Procesando...';
      }

      try {
        const formData = new FormData(form);

        const response = await fetch(form.dataset.endpoint, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          let errorMessage = 'No se pudo procesar el archivo.';

          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (_) {}

          throw new Error(errorMessage);
        }

        const blob = await response.blob();

        if (!blob.size) {
          throw new Error('El archivo generado está vacío.');
        }

        const filename = getFilename(response, config.fallback);

        downloadBlob(blob, filename);

        message.textContent = config.success;
        message.className = 'form-message success';

      } catch (error) {
        console.error(`Error en ${config.id}:`, error);

        message.textContent =
          error.message || 'Ocurrió un error al procesar el archivo.';

        message.className = 'form-message error';

      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    });
  });

});
