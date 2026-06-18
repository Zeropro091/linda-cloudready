/**
 * ImageEditorModal — Canvas-based image editor with crop, rotate, flip,
 * brightness/contrast/saturation adjustments, resize, and undo/redo.
 * Zero external dependencies — pure HTML5 Canvas.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './ImageEditorModal.module.css';

// ─── Types ───────────────────────────────────────────────────────
type Tool = 'crop' | 'rotate' | 'adjust' | 'resize';

interface CropRect {
  x: number; y: number; w: number; h: number;
}

interface Adjustments {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
}

interface HistoryEntry {
  imageData: ImageData;
  width: number;
  height: number;
}

interface Props {
  imageUrl: string;
  onSave: (blob: Blob, url: string) => void;
  onClose: () => void;
}

const DEFAULT_ADJUSTMENTS: Adjustments = {
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
};

const ASPECT_RATIOS: { label: string; value: number | null }[] = [
  { label: 'Free', value: null },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '3:2', value: 3 / 2 },
  { label: '2:3', value: 2 / 3 },
];

export default function ImageEditorModal({ imageUrl, onSave, onClose }: Props) {
  // ─── State ─────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<Tool>('crop');
  const [adjustments, setAdjustments] = useState<Adjustments>({ ...DEFAULT_ADJUSTMENTS });
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);

  // Crop state
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [dragType, setDragType] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStartRect, setCropStartRect] = useState<CropRect | null>(null);

  // Resize state
  const [resizeW, setResizeW] = useState(0);
  const [resizeH, setResizeH] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [originalAspect, setOriginalAspect] = useState(1);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const baseImageDataRef = useRef<ImageData | null>(null);

  // ─── Load Image ────────────────────────────────────────────────
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      sourceImageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      baseImageDataRef.current = imageData;
      setResizeW(img.naturalWidth);
      setResizeH(img.naturalHeight);
      setOriginalAspect(img.naturalWidth / img.naturalHeight);
      pushHistory(imageData, canvas.width, canvas.height);
      fitToWorkspace(img.naturalWidth, img.naturalHeight);
    };
    img.onerror = () => {
      // Try without crossOrigin for same-origin images
      const img2 = new Image();
      img2.onload = () => {
        sourceImageRef.current = img2;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img2.naturalWidth;
        canvas.height = img2.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img2, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        baseImageDataRef.current = imageData;
        setResizeW(img2.naturalWidth);
        setResizeH(img2.naturalHeight);
        setOriginalAspect(img2.naturalWidth / img2.naturalHeight);
        pushHistory(imageData, canvas.width, canvas.height);
        fitToWorkspace(img2.naturalWidth, img2.naturalHeight);
      };
      img2.src = imageUrl;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // ─── Fit zoom to workspace ─────────────────────────────────────
  const fitToWorkspace = useCallback((w: number, h: number) => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const pad = 40;
    const maxW = ws.clientWidth - pad * 2;
    const maxH = ws.clientHeight - pad * 2;
    const scale = Math.min(1, maxW / w, maxH / h);
    setZoom(Math.round(scale * 100) / 100);
  }, []);

  // ─── History ───────────────────────────────────────────────────
  const pushHistory = (imageData: ImageData, w: number, h: number) => {
    setHistory(prev => {
      const newHist = prev.slice(0, historyIndex + 1);
      newHist.push({ imageData: new ImageData(new Uint8ClampedArray(imageData.data), w, h), width: w, height: h });
      return newHist;
    });
    setHistoryIndex(prev => prev + 1);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    restoreFromHistory(history[newIdx]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    restoreFromHistory(history[newIdx]);
  };

  const restoreFromHistory = (entry: HistoryEntry) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = entry.width;
    canvas.height = entry.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(entry.imageData, 0, 0);
    baseImageDataRef.current = new ImageData(new Uint8ClampedArray(entry.imageData.data), entry.width, entry.height);
    setResizeW(entry.width);
    setResizeH(entry.height);
    setOriginalAspect(entry.width / entry.height);
    setCropRect(null);
    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
  };

  // ─── Apply adjustments to canvas ──────────────────────────────
  const applyAdjustments = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseImageDataRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { brightness, contrast, saturation } = adjustments;
    if (brightness === 0 && contrast === 0 && saturation === 0) {
      ctx.putImageData(base, 0, 0);
      return;
    }

    const data = new Uint8ClampedArray(base.data);
    const bFactor = brightness * 2.55;
    const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];

      // Brightness
      r += bFactor; g += bFactor; b += bFactor;

      // Contrast
      r = cFactor * (r - 128) + 128;
      g = cFactor * (g - 128) + 128;
      b = cFactor * (b - 128) + 128;

      // Saturation
      if (saturation !== 0) {
        const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
        const s = 1 + saturation / 100;
        r = gray + s * (r - gray);
        g = gray + s * (g - gray);
        b = gray + s * (b - gray);
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(new ImageData(data, base.width, base.height), 0, 0);
  }, [adjustments]);

  useEffect(() => {
    applyAdjustments();
  }, [applyAdjustments]);

  // ─── Rotate ────────────────────────────────────────────────────
  const rotate = (deg: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;

    if (Math.abs(deg) === 90) {
      tempCanvas.width = canvas.height;
      tempCanvas.height = canvas.width;
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tempCtx.rotate((deg * Math.PI) / 180);
      tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    } else {
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tempCtx.rotate((deg * Math.PI) / 180);
      tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    }

    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    ctx.drawImage(tempCanvas, 0, 0);

    const newData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    baseImageDataRef.current = newData;
    setResizeW(canvas.width);
    setResizeH(canvas.height);
    setOriginalAspect(canvas.width / canvas.height);
    setCropRect(null);
    pushHistory(newData, canvas.width, canvas.height);
  };

  // ─── Flip ──────────────────────────────────────────────────────
  const flip = (direction: 'h' | 'v') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (direction === 'h') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    const newData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    baseImageDataRef.current = newData;
    pushHistory(newData, canvas.width, canvas.height);
  };

  // ─── Crop ──────────────────────────────────────────────────────
  const initCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const margin = Math.min(canvas.width, canvas.height) * 0.1;
    let cw = canvas.width - margin * 2;
    let ch = canvas.height - margin * 2;
    if (aspectRatio) {
      if (cw / ch > aspectRatio) {
        cw = ch * aspectRatio;
      } else {
        ch = cw / aspectRatio;
      }
    }
    setCropRect({
      x: (canvas.width - cw) / 2,
      y: (canvas.height - ch) / 2,
      w: cw,
      h: ch,
    });
    setIsCropping(true);
  };

  const applyCrop = () => {
    if (!cropRect) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y, w, h } = cropRect;
    const croppedData = ctx.getImageData(
      Math.round(x), Math.round(y),
      Math.round(w), Math.round(h)
    );

    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    ctx.putImageData(croppedData, 0, 0);

    const newData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    baseImageDataRef.current = newData;
    setResizeW(canvas.width);
    setResizeH(canvas.height);
    setOriginalAspect(canvas.width / canvas.height);
    setCropRect(null);
    setIsCropping(false);
    pushHistory(newData, canvas.width, canvas.height);
    fitToWorkspace(canvas.width, canvas.height);
  };

  const cancelCrop = () => {
    setCropRect(null);
    setIsCropping(false);
  };

  // ─── Crop Mouse Handlers ───────────────────────────────────────
  const getCanvasPos = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  };

  const handleCropMouseDown = (e: React.MouseEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragType(type);
    const pos = getCanvasPos(e);
    setDragStart(pos);
    if (cropRect) setCropStartRect({ ...cropRect });
  };

  const handleWorkspaceMouseMove = (e: React.MouseEvent) => {
    if (!dragType || !cropRect || !cropStartRect) return;
    const pos = getCanvasPos(e);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let newRect = { ...cropStartRect };

    if (dragType === 'move') {
      newRect.x = Math.max(0, Math.min(canvas.width - newRect.w, cropStartRect.x + dx));
      newRect.y = Math.max(0, Math.min(canvas.height - newRect.h, cropStartRect.y + dy));
    } else {
      // Handle resize
      if (dragType.includes('r')) newRect.w = Math.max(20, cropStartRect.w + dx);
      if (dragType.includes('l')) {
        newRect.x = cropStartRect.x + dx;
        newRect.w = Math.max(20, cropStartRect.w - dx);
      }
      if (dragType.includes('b')) newRect.h = Math.max(20, cropStartRect.h + dy);
      if (dragType.includes('t')) {
        newRect.y = cropStartRect.y + dy;
        newRect.h = Math.max(20, cropStartRect.h - dy);
      }

      // Enforce aspect ratio
      if (aspectRatio) {
        if (dragType.includes('r') || dragType.includes('l')) {
          newRect.h = newRect.w / aspectRatio;
        } else {
          newRect.w = newRect.h * aspectRatio;
        }
      }

      // Clamp to canvas
      newRect.x = Math.max(0, newRect.x);
      newRect.y = Math.max(0, newRect.y);
      if (newRect.x + newRect.w > canvas.width) newRect.w = canvas.width - newRect.x;
      if (newRect.y + newRect.h > canvas.height) newRect.h = canvas.height - newRect.y;
    }

    setCropRect(newRect);
  };

  const handleWorkspaceMouseUp = () => {
    setDragType(null);
    setCropStartRect(null);
  };

  // ─── Resize ────────────────────────────────────────────────────
  const applyResize = () => {
    const canvas = canvasRef.current;
    if (!canvas || resizeW <= 0 || resizeH <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(canvas, 0, 0);

    canvas.width = resizeW;
    canvas.height = resizeH;
    ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, resizeW, resizeH);

    const newData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    baseImageDataRef.current = newData;
    setOriginalAspect(canvas.width / canvas.height);
    pushHistory(newData, canvas.width, canvas.height);
    fitToWorkspace(canvas.width, canvas.height);
  };

  const handleResizeW = (val: number) => {
    setResizeW(val);
    if (lockAspect && originalAspect) {
      setResizeH(Math.round(val / originalAspect));
    }
  };

  const handleResizeH = (val: number) => {
    setResizeH(val);
    if (lockAspect && originalAspect) {
      setResizeW(Math.round(val * originalAspect));
    }
  };

  // ─── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Failed to export')), 'image/jpeg', 0.92);
      });
      const url = URL.createObjectURL(blob);
      onSave(blob, url);
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to export image');
    } finally {
      setSaving(false);
    }
  };

  // ─── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCropping) cancelCrop();
        else onClose();
      }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Enter' && isCropping) { e.preventDefault(); applyCrop(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCropping, cropRect, historyIndex]);

  // ─── Current canvas dimensions ─────────────────────────────────
  const canvasW = canvasRef.current?.width || 0;
  const canvasH = canvasRef.current?.height || 0;

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span>✏️</span> Image Editor
            {canvasW > 0 && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
              {canvasW} × {canvasH}px
            </span>}
          </div>
          <div className={styles.headerActions}>
            <button className={`${styles.headerBtn} ${styles.btnCancel}`} onClick={onClose}>Cancel</button>
            <button className={`${styles.headerBtn} ${styles.btnSave}`} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : '💾 Save & Apply'}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>
          {/* Left Toolbar */}
          <div className={styles.toolbar}>
            {([
              { id: 'crop' as Tool, icon: '⬡', label: 'Crop' },
              { id: 'rotate' as Tool, icon: '↻', label: 'Rotate' },
              { id: 'adjust' as Tool, icon: '◐', label: 'Adjust' },
              { id: 'resize' as Tool, icon: '⤢', label: 'Resize' },
            ]).map(tool => (
              <button
                key={tool.id}
                className={`${styles.toolBtn} ${activeTool === tool.id ? styles.toolBtnActive : ''}`}
                onClick={() => { setActiveTool(tool.id); if (tool.id === 'crop') initCrop(); else cancelCrop(); }}
              >
                <span className={styles.toolIcon}>{tool.icon}</span>
                <span className={styles.toolLabel}>{tool.label}</span>
              </button>
            ))}

            <div className={styles.toolDivider} />

            {/* Quick actions */}
            <button className={styles.toolBtn} onClick={() => flip('h')} title="Flip Horizontal">
              <span className={styles.toolIcon}>↔</span>
              <span className={styles.toolLabel}>Flip H</span>
            </button>
            <button className={styles.toolBtn} onClick={() => flip('v')} title="Flip Vertical">
              <span className={styles.toolIcon}>↕</span>
              <span className={styles.toolLabel}>Flip V</span>
            </button>
          </div>

          {/* Canvas Workspace */}
          <div
            className={styles.workspace}
            ref={workspaceRef}
            onMouseMove={handleWorkspaceMouseMove}
            onMouseUp={handleWorkspaceMouseUp}
            onMouseLeave={handleWorkspaceMouseUp}
          >
            <div className={styles.canvasContainer} style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
              <canvas ref={canvasRef} className={styles.canvas} />

              {/* Crop Overlay */}
              {isCropping && cropRect && (
                <div className={styles.cropOverlay}>
                  <div
                    className={styles.cropRegion}
                    style={{
                      left: cropRect.x, top: cropRect.y,
                      width: cropRect.w, height: cropRect.h,
                    }}
                    onMouseDown={(e) => handleCropMouseDown(e, 'move')}
                  >
                    {['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'].map(h => (
                      <div
                        key={h}
                        className={`${styles.cropHandle} ${styles[h]}`}
                        onMouseDown={(e) => handleCropMouseDown(e, h)}
                      />
                    ))}
                    <div className={styles.cropInfo}>
                      {Math.round(cropRect.w)} × {Math.round(cropRect.h)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Zoom Controls */}
            <div className={styles.zoomControls}>
              <button className={styles.zoomBtn} onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}>−</button>
              <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
              <button className={styles.zoomBtn} onClick={() => setZoom(z => Math.min(3, z + 0.1))}>+</button>
              <button className={styles.zoomBtn} onClick={() => fitToWorkspace(canvasW, canvasH)} title="Fit">⊡</button>
            </div>
          </div>

          {/* Right Panel */}
          <div className={styles.panel}>
            {/* ── Crop Panel ── */}
            {activeTool === 'crop' && (
              <div className={styles.panelSection}>
                <div className={styles.panelTitle}>Crop</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>Aspect Ratio</div>
                  <div className={styles.chipRow}>
                    {ASPECT_RATIOS.map(ar => (
                      <button
                        key={ar.label}
                        className={`${styles.chip} ${aspectRatio === ar.value ? styles.chipActive : ''}`}
                        onClick={() => { setAspectRatio(ar.value); }}
                      >
                        {ar.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.actionRow}>
                  <button className={styles.actionBtn} onClick={initCrop}>Reset Crop</button>
                  <button className={styles.actionBtn} style={{ background: 'rgba(29,158,117,0.15)', color: '#1D9E75', borderColor: 'rgba(29,158,117,0.3)' }} onClick={applyCrop}>
                    ✓ Apply
                  </button>
                </div>
                {isCropping && (
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 8, textAlign: 'center' }}>
                    Drag handles to adjust • Enter to apply • Esc to cancel
                  </div>
                )}
              </div>
            )}

            {/* ── Rotate Panel ── */}
            {activeTool === 'rotate' && (
              <div className={styles.panelSection}>
                <div className={styles.panelTitle}>Rotate & Flip</div>
                <div className={styles.actionRow} style={{ marginBottom: 10 }}>
                  <button className={styles.actionBtn} onClick={() => rotate(-90)}>↶ 90°</button>
                  <button className={styles.actionBtn} onClick={() => rotate(90)}>↷ 90°</button>
                </div>
                <div className={styles.actionRow}>
                  <button className={styles.actionBtn} onClick={() => flip('h')}>↔ Flip H</button>
                  <button className={styles.actionBtn} onClick={() => flip('v')}>↕ Flip V</button>
                </div>
              </div>
            )}

            {/* ── Adjustments Panel ── */}
            {activeTool === 'adjust' && (
              <div className={styles.panelSection}>
                <div className={styles.panelTitle}>Adjustments</div>
                {[
                  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
                  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
                  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
                ].map(({ key, label, min, max }) => (
                  <div key={key} className={styles.sliderRow}>
                    <span className={styles.sliderLabel}>{label}</span>
                    <input
                      type="range"
                      className={styles.sliderInput}
                      min={min} max={max} step={1}
                      value={(adjustments as any)[key]}
                      onChange={(e) => setAdjustments(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                    />
                    <span className={styles.sliderValue}>{(adjustments as any)[key]}</span>
                  </div>
                ))}
                <button
                  className={styles.actionBtn}
                  style={{ marginTop: 8, width: '100%' }}
                  onClick={() => {
                    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
                  }}
                >
                  Reset All
                </button>
                <button
                  className={styles.actionBtn}
                  style={{ marginTop: 6, width: '100%', background: 'rgba(29,158,117,0.15)', color: '#1D9E75', borderColor: 'rgba(29,158,117,0.3)' }}
                  onClick={() => {
                    // Bake adjustments into the image
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    const newData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    baseImageDataRef.current = newData;
                    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
                    pushHistory(newData, canvas.width, canvas.height);
                  }}
                >
                  ✓ Apply Adjustments
                </button>
              </div>
            )}

            {/* ── Resize Panel ── */}
            {activeTool === 'resize' && (
              <div className={styles.panelSection}>
                <div className={styles.panelTitle}>Resize</div>
                <div className={styles.resizeRow}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      className={styles.resizeInput}
                      value={resizeW}
                      onChange={(e) => handleResizeW(parseInt(e.target.value) || 0)}
                      min={1} max={10000}
                    />
                    <div className={styles.resizeLabel}>Width</div>
                  </div>
                  <button
                    className={`${styles.resizeLock} ${lockAspect ? styles.resizeLockActive : ''}`}
                    onClick={() => setLockAspect(!lockAspect)}
                    title={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                  >
                    {lockAspect ? '🔗' : '🔓'}
                  </button>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      className={styles.resizeInput}
                      value={resizeH}
                      onChange={(e) => handleResizeH(parseInt(e.target.value) || 0)}
                      min={1} max={10000}
                    />
                    <div className={styles.resizeLabel}>Height</div>
                  </div>
                </div>
                <button
                  className={styles.actionBtn}
                  style={{ marginTop: 10, width: '100%', background: 'rgba(29,158,117,0.15)', color: '#1D9E75', borderColor: 'rgba(29,158,117,0.3)' }}
                  onClick={applyResize}
                >
                  ✓ Apply Resize
                </button>
              </div>
            )}

            {/* ── Info ── */}
            <div className={styles.panelSection} style={{ borderBottom: 'none', marginTop: 'auto' }}>
              <div className={styles.panelTitle}>Shortcuts</div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.8 }}>
                <div><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>Ctrl+Z</kbd> Undo</div>
                <div><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>Ctrl+Y</kbd> Redo</div>
                <div><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>Enter</kbd> Apply crop</div>
                <div><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>Esc</kbd> Cancel / Close</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <div className={styles.historyBtns}>
            <button className={styles.historyBtn} onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)">↶</button>
            <button className={styles.historyBtn} onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)">↷</button>
          </div>
          <div className={styles.footerInfo}>
            <span>Step {historyIndex + 1} of {history.length}</span>
            {canvasW > 0 && <span>{canvasW} × {canvasH}px</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
