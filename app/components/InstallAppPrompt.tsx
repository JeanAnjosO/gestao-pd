"use client";

import { useEffect, useState } from "react";
import type { InstallPromptEvent } from "../domain/types";
import { isMobileSession } from "../domain/utils";

export function InstallAppPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const isIos = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  useEffect(() => {
    if (!isMobileSession()) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) return;
    const reveal = window.setTimeout(() => setVisible(true), 1200);
    const capture = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); setVisible(true); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => { window.clearTimeout(reveal); window.removeEventListener("beforeinstallprompt", capture); };
  }, []);
  if (!visible) return null;
  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
      setInstallPrompt(null);
      return;
    }
    if (isIos && navigator.share) {
      try { await navigator.share({ title: "Gestão PD", text: "Adicionar o Gestão PD à tela inicial", url: window.location.href }); }
      catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error); }
    }
  };
  return <aside className="install-app-card" aria-label="Instalar Gestão PD">
    <button type="button" className="install-close" aria-label="Fechar aviso de instalação" onClick={() => setVisible(false)}>×</button>
    <img src="/icon-192.png" alt="" width="46" height="46" />
    <div><strong>Gestão PD no celular</strong><span>Adicione à tela inicial e abra como um aplicativo.</span></div>
    <ol className="install-steps">{isIos ? <><li>Toque em <b>Compartilhar</b>.</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li><li>Ative <b>Abrir como App da Web</b> e toque em <b>Adicionar</b>.</li></> : installPrompt ? <><li>Toque em <b>Instalar agora</b>.</li><li>Confirme a instalação no navegador.</li><li>Abra pelo novo ícone na tela inicial.</li></> : <><li>Abra o menu do navegador.</li><li>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li><li>Confirme e abra pelo novo ícone.</li></>}</ol>
    <button type="button" className="primary" onClick={install}>{installPrompt ? "Instalar agora" : isIos ? "Abrir compartilhamento" : "Como instalar"}</button>
  </aside>;
}
