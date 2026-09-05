// cloudinary.js
// Uses an UNSIGNED upload preset — never put the Cloudinary API secret in this file
// or anywhere else client-side. Create the preset at:
// Cloudinary Dashboard → Settings → Upload → Upload presets → Add upload preset → Signing Mode: Unsigned

const CLOUDINARY_CLOUD_NAME = "xtrrhfj7";
const CLOUDINARY_UPLOAD_PRESET = "REPLACE_WITH_YOUR_UNSIGNED_PRESET"; // <-- set this before launch

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Uploads a File/Blob to Cloudinary using the unsigned preset.
 * @param {File} file
 * @param {(pct:number)=>void} onProgress optional progress callback (0-100)
 * @returns {Promise<string>} secure_url of the uploaded image
 */
export function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file provided"));
    if (CLOUDINARY_UPLOAD_PRESET === "REPLACE_WITH_YOUR_UNSIGNED_PRESET") {
      return reject(
        new Error(
          "Cloudinary upload preset not configured yet — set CLOUDINARY_UPLOAD_PRESET in js/cloudinary.js"
        )
      );
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", CLOUDINARY_URL, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
          resolve(res.secure_url);
        } else {
          reject(new Error(res.error?.message || "Upload failed"));
        }
      } catch (err) {
        reject(err);
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}
