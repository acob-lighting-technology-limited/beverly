import type { AudioRecording, ActiveCall } from '../types';
import { api } from '../lib/api';

const DB_NAME = 'bv_vc';
const STORE_NAME = 'recs';
const DB_VERSION = 1;

export interface QaChecklist {
  greeting: boolean;
  verification: boolean;
  diagnosis: boolean;
  accuracy: boolean;
  policyCompliance: boolean;
  documentation: boolean;
}

export class RecordingsPipelineService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.reject(new Error('IndexedDB not supported in this environment'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Media Recorder & Audio Track Pipeline
  // ═══════════════════════════════════════════════════════════════════════

  async startCapture(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.recordedChunks = [];

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          const src = this.audioContext.createMediaStreamSource(this.mediaStream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 64;
          src.connect(this.analyser);
        }
      } catch {}

      if (typeof MediaRecorder !== 'undefined') {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : '';

        this.mediaRecorder = mimeType ? new MediaRecorder(this.mediaStream, { mimeType }) : new MediaRecorder(this.mediaStream);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
        };
        this.mediaRecorder.start(1000);
      }
      return true;
    } catch (err) {
      // Microphone not permitted or unavailable — graceful fallback to simulated recording
      return false;
    }
  }

  setMuted(muted: boolean) {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    }
  }

  stopCapture(): Blob | null {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    if (this.recordedChunks.length > 0) {
      const mime = this.recordedChunks[0].type || 'audio/webm';
      const blob = new Blob(this.recordedChunks, { type: mime });
      this.recordedChunks = [];
      return blob;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Storage Pipeline (IndexedDB + API Sync)
  // ═══════════════════════════════════════════════════════════════════════

  async saveRecording(call: ActiveCall, recordedBlob?: Blob | null): Promise<AudioRecording> {
    const dur = Math.round((Date.now() - call.start * 1000) / 1000) || 45;
    const recId = `REC-${call.c.id}-${Date.now()}`;
    const transcript = call.tr.map((t) => `${t.w === 'a' ? 'Agent' : call.c.cust.name}: ${t.t}`);

    const item: AudioRecording = {
      id: recId,
      callId: call.c.id,
      name: call.c.cust.name,
      meter: call.c.cust.meter,
      dur,
      t: new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
      tr: transcript.length ? transcript : ['Call session audio archived. Transcription pending speech model review.'],
      blob: recordedBlob || null,
      url: recordedBlob ? URL.createObjectURL(recordedBlob) : '',
      qa: 95,
    };

    // 1. Local IndexedDB storage
    try {
      const db = await this.initDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {}

    // 2. Best-effort API upload / audit record
    try {
      await api.post('/api/v1/admin/support/recordings', {
        id: item.id,
        call_id: item.callId,
        customer_name: item.name,
        meter_number: item.meter,
        duration_seconds: item.dur,
        qa_score: item.qa,
      });
    } catch {
      // Offline fallback: retained in IndexedDB
    }

    return item;
  }

  async getAllRecordings(): Promise<AudioRecording[]> {
    try {
      const db = await this.initDb();
      return await new Promise<AudioRecording[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => {
          const list: AudioRecording[] = (req.result || []).map((m: any) => ({
            ...m,
            url: m.blob ? URL.createObjectURL(m.blob) : (m.url || ''),
          }));
          list.sort((a, b) => (b.id < a.id ? -1 : 1));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async deleteRecording(id: string): Promise<boolean> {
    try {
      const db = await this.initDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // QA Scoring Pipeline
  // ═══════════════════════════════════════════════════════════════════════

  computeQaScore(checklist: QaChecklist): number {
    const weights: Record<keyof QaChecklist, number> = {
      greeting: 10,
      verification: 25,
      diagnosis: 20,
      accuracy: 25,
      policyCompliance: 10,
      documentation: 10,
    };

    let total = 0;
    for (const [key, val] of Object.entries(checklist)) {
      if (val) total += weights[key as keyof QaChecklist] || 0;
    }
    return total;
  }

  async updateQaScore(id: string, score: number): Promise<void> {
    try {
      const db = await this.initDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const item = getReq.result;
          if (item) {
            item.qa = score;
            store.put(item);
          }
          resolve();
        };
        getReq.onerror = () => reject(getReq.error);
      });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Export Pipeline
  // ═══════════════════════════════════════════════════════════════════════

  exportRecordingFile(rec: AudioRecording) {
    if (!rec.blob) {
      // Export transcript if audio blob was simulated
      const text = `BEVERLY CALL RECORDING ARCHIVE\nID: ${rec.id}\nCaller: ${rec.name}\nMeter: ${rec.meter}\nDuration: ${rec.dur}s\nDate: ${rec.t}\nQA Score: ${rec.qa}%\n\nTRANSCRIPT:\n${rec.tr.join('\n')}`;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      this.triggerDownload(blob, `${rec.id}-transcript.txt`);
      return;
    }
    const ext = rec.blob.type.includes('ogg') ? 'ogg' : 'webm';
    this.triggerDownload(rec.blob, `${rec.id}.${ext}`);
  }

  private triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

export const recordingsPipeline = new RecordingsPipelineService();
