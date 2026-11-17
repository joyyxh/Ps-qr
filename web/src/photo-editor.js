// The customer's photo editor: turn, crop (with passport and print sizes) and basic brightness and
// contrast. It opens before a JPEG or PNG is uploaded. Everything runs in the browser.
import { UPLOAD_MAX_BYTES } from './logic.js';
import {
  CROP_PRESETS,
  EDIT_MAX_SIDE,
  adjustTable,
  clampCrop,
  defaultCrop,
  editedFileName,
  isNoAdjust,
  isUnchangedEdit,
  moveCrop,
  normalizeTurns,
  outputSize,
  presetRatio,
  resizeCrop,
  turnMatrix,
  turnedSize,
} from './photo-edit.js';

const PREVIEW_MAX_SIDE = 900;
const JPEG_QUALITY = 0.92;
const JPEG_QUALITY_SMALL = 0.8;

// Draws the picture turned and cropped onto ctx. `crop` is in turned-picture pixels and `scale`
// maps those pixels onto the canvas.
function drawPicture(ctx, img, width, height, turns, crop, scale) {
  const m = turnMatrix(width, height, turns);
  ctx.setTransform(scale * m.a, scale * m.b, scale * m.c, scale * m.d, scale * (m.e - crop.x), scale * (m.f - crop.y));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function applyAdjust(ctx, width, height, brightness, contrast) {
  if (isNoAdjust(brightness, contrast)) return;
  const image = ctx.getImageData(0, 0, width, height);
  const table = adjustTable(brightness, contrast);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = table[data[i]];
    data[i + 1] = table[data[i + 1]];
    data[i + 2] = table[data[i + 2]];
  }
  ctx.putImageData(image, 0, 0);
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// Opens the editor for a chosen picture. Resolves with the File to upload: the edited JPEG, the
// original when the customer keeps it unchanged, or null when they cancel.
export function openPhotoEditor(file) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'photo-editor';
    dialog.setAttribute('aria-labelledby', 'photo-editor-title');
    dialog.innerHTML = `
      <h2 id="photo-editor-title">Adjust your picture</h2>
      <p class="muted small">Drag the frame to choose the part that prints. Pick a size for passport or photo prints.</p>
      <div class="photo-stage" data-stage>
        <canvas data-view aria-label="Your picture"></canvas>
        <div class="photo-crop" data-crop><span class="photo-crop-handle" data-handle aria-hidden="true"></span></div>
      </div>
      <p class="error" data-error role="alert"></p>
      <div class="photo-tools" role="group" aria-label="Turn">
        <button type="button" class="secondary" data-turn="3">Turn left</button>
        <button type="button" class="secondary" data-turn="1">Turn right</button>
      </div>
      <div class="photo-presets" role="group" aria-label="Crop shape">
        ${CROP_PRESETS.map((preset) => `<button type="button" class="secondary" data-preset="${preset.key}" aria-pressed="${preset.key === 'free'}">${preset.label}</button>`).join('')}
      </div>
      <label>Brightness <input type="range" min="-100" max="100" step="1" value="0" data-adjust="brightness" /></label>
      <label>Contrast <input type="range" min="-100" max="100" step="1" value="0" data-adjust="contrast" /></label>
      <div class="photo-actions">
        <button type="button" class="link" data-action="reset">Reset</button>
        <button type="button" class="secondary" data-action="original">Use without changes</button>
        <button type="button" data-action="use">Use this picture</button>
        <button type="button" class="link" data-action="cancel">Cancel</button>
      </div>`;

    const $ = (selector) => dialog.querySelector(selector);
    const stage = $('[data-stage]');
    const view = $('[data-view]');
    const cropBox = $('[data-crop]');
    const errorBox = $('[data-error]');
    const useButton = $('[data-action="use"]');
    const originalButton = $('[data-action="original"]');
    const url = URL.createObjectURL(file);
    const img = new Image();
    const base = document.createElement('canvas');
    const state = { turns: 0, brightness: 0, contrast: 0, preset: 'free', crop: null, width: 0, height: 0 };
    let settled = false;

    function finish(result) {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(result);
    }

    function showError(message) {
      errorBox.textContent = message;
    }

    function turned() {
      return turnedSize(state.width, state.height, state.turns);
    }

    // The preview copy of the turned picture, at a size the phone can redraw quickly.
    function drawBase() {
      const t = turned();
      const size = outputSize(t.width, t.height, PREVIEW_MAX_SIDE);
      base.width = size.width;
      base.height = size.height;
      drawPicture(base.getContext('2d'), img, state.width, state.height, state.turns,
        { x: 0, y: 0, w: t.width, h: t.height }, size.width / t.width);
    }

    function renderView() {
      view.width = base.width;
      view.height = base.height;
      const ctx = view.getContext('2d');
      ctx.drawImage(base, 0, 0);
      applyAdjust(ctx, view.width, view.height, state.brightness, state.contrast);
    }

    function renderCrop() {
      const t = turned();
      const c = state.crop;
      // Width follows the shape and is capped so a tall picture still fits the screen height.
      stage.style.width = `min(100%, ${((50 * t.width) / t.height).toFixed(3)}vh)`;
      cropBox.style.left = `${(c.x / t.width) * 100}%`;
      cropBox.style.top = `${(c.y / t.height) * 100}%`;
      cropBox.style.width = `${(c.w / t.width) * 100}%`;
      cropBox.style.height = `${(c.h / t.height) * 100}%`;
    }

    function renderControls() {
      dialog.querySelectorAll('[data-preset]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.preset === state.preset));
      });
      $('[data-adjust="brightness"]').value = String(state.brightness);
      $('[data-adjust="contrast"]').value = String(state.contrast);
    }

    function renderAll() {
      renderView();
      renderCrop();
      renderControls();
    }

    function resetCropForCurrentShape() {
      const t = turned();
      state.crop = defaultCrop(t.width, t.height, presetRatio(state.preset));
    }

    function startDrag(event, mode) {
      event.preventDefault();
      event.stopPropagation();
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      const start = { x: event.clientX, y: event.clientY, crop: { ...state.crop } };
      const ratio = presetRatio(state.preset);
      const onMove = (moveEvent) => {
        const rect = stage.getBoundingClientRect();
        const t = turned();
        const dx = ((moveEvent.clientX - start.x) / rect.width) * t.width;
        const dy = ((moveEvent.clientY - start.y) / rect.height) * t.height;
        state.crop = mode === 'move'
          ? moveCrop(start.crop, dx, dy, t.width, t.height, ratio)
          : resizeCrop(start.crop, dx, dy, t.width, t.height, ratio);
        renderCrop();
      };
      const onEnd = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    }

    cropBox.addEventListener('pointerdown', (event) => {
      if (event.target === cropBox) startDrag(event, 'move');
    });
    $('[data-handle]').addEventListener('pointerdown', (event) => startDrag(event, 'resize'));

    dialog.querySelectorAll('[data-turn]').forEach((button) => {
      button.addEventListener('click', () => {
        state.turns = normalizeTurns(state.turns + Number(button.dataset.turn));
        drawBase();
        resetCropForCurrentShape();
        renderAll();
      });
    });

    dialog.querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        state.preset = button.dataset.preset;
        resetCropForCurrentShape();
        renderAll();
      });
    });

    dialog.querySelectorAll('[data-adjust]').forEach((input) => {
      input.addEventListener('input', () => {
        state[input.dataset.adjust] = Number(input.value);
        renderView();
        renderControls();
      });
    });

    $('[data-action="reset"]').addEventListener('click', () => {
      state.turns = 0;
      state.brightness = 0;
      state.contrast = 0;
      state.preset = 'free';
      drawBase();
      state.crop = defaultCrop(state.width, state.height, null);
      renderAll();
    });

    originalButton.addEventListener('click', () => finish(file));
    $('[data-action="cancel"]').addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener('close', () => finish(null));

    // Makes the file that is uploaded: the crop, turned and adjusted, at most EDIT_MAX_SIDE pixels.
    useButton.addEventListener('click', async () => {
      showError('');
      if (isUnchangedEdit({ ...state, crop: state.crop, width: state.width, height: state.height })) {
        finish(file);
        return;
      }
      useButton.disabled = true;
      try {
        const crop = clampCrop(state.crop, turned().width, turned().height, presetRatio(state.preset));
        const size = outputSize(crop.w, crop.h, EDIT_MAX_SIDE);
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext('2d');
        drawPicture(ctx, img, state.width, state.height, state.turns, crop, size.width / crop.w);
        applyAdjust(ctx, canvas.width, canvas.height, state.brightness, state.contrast);
        let blob = await canvasToBlob(canvas, JPEG_QUALITY);
        if (blob && blob.size > UPLOAD_MAX_BYTES) blob = await canvasToBlob(canvas, JPEG_QUALITY_SMALL);
        if (!blob) throw new Error('This picture could not be prepared.');
        if (blob.size > UPLOAD_MAX_BYTES) {
          showError('The edited picture is still larger than 10 MB. Use a smaller crop, or use the picture without changes.');
          useButton.disabled = false;
          return;
        }
        finish(new File([blob], editedFileName(file.name), { type: 'image/jpeg' }));
      } catch (err) {
        showError(`${err.message} Try again, or use the picture without changes.`);
        useButton.disabled = false;
      }
    });

    img.onload = () => {
      state.width = img.naturalWidth;
      state.height = img.naturalHeight;
      if (!state.width || !state.height) {
        showError('This picture could not be opened here. Use it without changes or choose another file.');
        useButton.disabled = true;
        return;
      }
      state.crop = defaultCrop(state.width, state.height, null);
      drawBase();
      renderAll();
    };
    img.onerror = () => {
      showError('This picture could not be opened here. Use it without changes or choose another file.');
      useButton.disabled = true;
    };

    document.body.append(dialog);
    dialog.showModal();
    img.src = url;
    useButton.focus();
  });
}
