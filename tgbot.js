async function sendToTelegram(name, email, message) {
  const text = `📩 Новое сообщение с сайта!\n\n👤 Имя: ${name}\n📧 Email: ${email}\n\n💬 ${message}`;
  await fetch("https://api.telegram.org/bot8700001259:AAHGcY72GDbbttjyyuUT_-0pq_52Om3NuPw/sendMessage", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({chat_id: "1265606881", text: text})
  });
}
