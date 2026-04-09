import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { decryptWithKey, encryptWithKey, exportKeyToBase64, importKeyFromBase64 } from "../utils/crypto";

type EncryptionCtx = {
  /** AES CryptoKey in memory (derived once at login). Null if not available (e.g. after refresh). */
  encryptionKey: CryptoKey | null;
  /** Set after login when we derive K from password+salt. Cleared on logout/401. */
  setEncryptionKey: (key: CryptoKey | null) => void;
  /** Encrypt JSON-serializable payload when key is present; otherwise return null. */
  encryptPayload: <T>(payload: T) => Promise<string | null>;
  /** Decrypt base64 ciphertext when key is present; otherwise return null. */
  decryptPayload: <T>(ciphertextBase64: string) => Promise<T | null>;
  /** True when we have K in memory (encryption active this session). */
  hasEncryptionSupport: boolean;
};

const Ctx = createContext<EncryptionCtx | null>(null);

const LOGOUT_EVENT = "ground:logout";
const SESSION_STORAGE_KEY = "ground:e2ee:key:v1";

export function EncryptionProvider(props: { children: React.ReactNode }) {
  const [encryptionKey, setEncryptionKeyState] = useState<CryptoKey | null>(null);
  const hasEncryptionSupport = !!encryptionKey;

  const setEncryptionKey = useCallback((key: CryptoKey | null) => {
    setEncryptionKeyState(key);
  }, []);

  useEffect(() => {
    const onLogout = () => setEncryptionKeyState(null);
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout);
  }, []);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return;
    importKeyFromBase64(stored)
      .then((key) => setEncryptionKeyState(key))
      .catch(() => {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      });
  }, []);

  useEffect(() => {
    if (!encryptionKey) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    exportKeyToBase64(encryptionKey)
      .then((raw) => window.sessionStorage.setItem(SESSION_STORAGE_KEY, raw))
      .catch(() => {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      });
  }, [encryptionKey]);

  const encryptPayload = useCallback(
    async <T,>(payload: T): Promise<string | null> => {
      if (!encryptionKey) return null;
      try {
        const json = JSON.stringify(payload);
        return await encryptWithKey(json, encryptionKey);
      } catch {
        return null;
      }
    },
    [encryptionKey]
  );

  const decryptPayload = useCallback(
    async <T,>(ciphertextBase64: string): Promise<T | null> => {
      if (!encryptionKey) return null;
      try {
        const json = await decryptWithKey(ciphertextBase64, encryptionKey);
        return JSON.parse(json) as T;
      } catch {
        return null;
      }
    },
    [encryptionKey]
  );

  const value: EncryptionCtx = {
    encryptionKey,
    setEncryptionKey,
    encryptPayload,
    decryptPayload,
    hasEncryptionSupport,
  };

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useEncryption() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEncryption must be used within EncryptionProvider");
  return ctx;
}

/** Dispatch when token is cleared (e.g. 401) so we clear the in-memory key. */
export function dispatchLogout() {
  window.dispatchEvent(new Event(LOGOUT_EVENT));
}
