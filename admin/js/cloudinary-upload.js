// Uploads a File object directly to Cloudinary using a short-lived signature
// from our backend. The API secret never touches the browser — only a
// signature valid for this one upload request.
//
// Usage: const { url, publicId } = await uploadImageToCloudinary(file, 'herform/exercises');
async function uploadImageToCloudinary(file, folder) {
  const { signature, timestamp, apiKey, cloudName, folder: signedFolder } =
    await api.getUploadSignature(folder);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', signedFolder);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const res = await fetch(uploadUrl, { method: 'POST', body: formData });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || 'Image upload failed');
  }

  return { url: data.secure_url, publicId: data.public_id };
}

// Wires a hidden file input + a trigger button/area to the upload flow, and
// calls onUploaded({ url, publicId }) when done. Shows a simple inline
// progress state on the trigger element while uploading.
function setupImageUploadControl({ triggerEl, previewEl, folder, onUploaded }) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  triggerEl.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    const originalText = triggerEl.textContent;
    triggerEl.textContent = 'Uploading...';
    triggerEl.disabled = true;

    try {
      const { url, publicId } = await uploadImageToCloudinary(file, folder);
      if (previewEl) {
        previewEl.src = url;
        previewEl.style.display = 'block';
      }
      onUploaded({ url, publicId });
    } catch (err) {
      ui.alert(err.message);
    } finally {
      triggerEl.textContent = originalText;
      triggerEl.disabled = false;
      input.value = '';
    }
  });
}