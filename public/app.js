
document.addEventListener('DOMContentLoaded', () => {
  // Año del footer
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Menú móvil
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');

  menuToggle?.addEventListener('click', () => {
    const opened = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(opened));
    menuToggle.textContent = opened ? '✕' : '☰';
  });

  mainNav?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      menuToggle?.setAttribute('aria-expanded', 'false');
      if (menuToggle) menuToggle.textContent = '☰';
    });
  });

  // Pestañas de herramientas
  const tabs = document.querySelectorAll('.tool-tab');
  const panels = document.querySelectorAll('.tool-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const selected = tab.dataset.tool;

      tabs.forEach(item => {
        item.classList.toggle('active', item === tab);
      });

      panels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${selected}`);
      });
    });
  });

  // Selección y validación de archivos
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  const maxSize = 15 * 1024 * 1024;

  ['convert', 'compress', 'resize'].forEach(type => {
    const input = document.getElementById(`${type}File`);
    const name = document.getElementById(`${type}FileName`);
    const form = document.getElementById(`${type}Form`);
    const message = document.getElementById(`${type}Message`);

    if (!input || !form) return;

    input.addEventListener('change', () => {
      const file = input.files[0];

      if (!file) {
        name.textContent = 'Ningún archivo seleccionado';
        return;
      }

      if (!allowedTypes.includes(file.type)) {
        input.value = '';
        name.textContent = 'Ningún archivo seleccionado';
        message.textContent = 'Formato no permitido. Usa JPG, PNG o WEBP.';
        return;
      }

      if (file.size > maxSize) {
        input.value = '';
        name.textContent = 'Ningún archivo seleccionado';
        message.textContent = 'El archivo supera el límite de 15 MB.';
        return;
      }

      name.textContent = `${file.name} (${formatBytes(file.size)})`;
      message.textContent = '';
    });

    // Procesamiento de cada herramienta
    form.addEventListener('submit', async event => {
      event.preventDefault();

      const file = input.files[0];

      if (!file) {
        message.textContent = 'Primero selecciona una imagen.';
        return;
      }

      if (!allowedTypes.includes(file.type) || file.size > maxSize) {
        message.textContent = 'Revisa el formato y el tamaño del archivo.';
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = 'Procesando...';
      message.textContent = 'Estamos trabajando en tu imagen.';

      try {
        const formData = new FormData(form);

        const response = await fetch(form.dataset.endpoint, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          let errorMessage = 'No se pudo procesar la imagen.';

          try {
            const data = await response.json();
            if (data.error) errorMessage = data.error;
          } catch (_) {}

          throw new Error(errorMessage);
        }

        const blob = await response.blob();

        if (!blob.size) {
          throw new Error('El servidor devolvió un archivo vacío.');
        }

        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/i);

        let filename = match
          ? match[1]
          : `${type === 'convert' ? 'imagen-convertida' : type === 'compress' ? 'imagen-comprimida' : 'imagen-redimensionada'}`;

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

        message.textContent = '¡Listo! Tu imagen se ha procesado y descargado.';
      } catch (error) {
        message.textContent = error.message || 'Ocurrió un error inesperado.';
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });

  // Formato de tamaños
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
});
