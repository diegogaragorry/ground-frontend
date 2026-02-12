/**
 * Base path for the authenticated app (dashboard, expenses, etc.)
 * Landing page is at /, login/register at /login, /register.
 */
export const APP_BASE = "/app";

/** WhatsApp contact link (support / consultas). Opens chat with this number. */
export const CONTACT_WHATSAPP_NUMBER = "59898901761";
export const CONTACT_WHATSAPP_URL = `https://wa.me/${CONTACT_WHATSAPP_NUMBER}?text=${encodeURIComponent("Hola, tengo una consulta sobre Ground.")}`;
