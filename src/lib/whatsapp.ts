/**
 * WhatsApp click-to-chat helpers. The canonical notification messages are rendered by
 * database triggers (see *_workflow.sql) so they fire no matter which client changes the
 * status; these helpers cover ad-hoc links (e.g. "message customer" buttons).
 */

/** 012-345 6789 → 60123456789 */
export function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `6${digits}`;
  return digits;
}

export function whatsappLink(phone: string, message: string) {
  return `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`;
}

export function jobDoneMessage(p: { customerName: string; orderNo: string; technicianName: string; time: string }) {
  return `Hi ${p.customerName},\nJob ${p.orderNo} has been completed by Technician ${p.technicianName} at ${p.time}.\nPlease check and leave feedback.\nThank you!`;
}

export function telLink(phone: string) {
  return `tel:+${toWhatsAppNumber(phone)}`;
}

export function mapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function wazeLink(address: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}
