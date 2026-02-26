import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { encryptWithKey, decryptWithKey } from "../utils/crypto";

let decryptCounter = 0;
export { decryptCounter };

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
    decryptCounter = 0;
  }, [encryptionKey]);

  void decryptWithKey; // TEMP: stub decryptPayload so not used

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
    async <T,>(_ciphertextBase64: string): Promise<T | null> => {
      return null;
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
