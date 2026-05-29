(function () {
  function setStatus(form, type, message) {
    const status = form.querySelector('[data-form-status]');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'form-status' + (type === 'error' ? ' error' : '');
  }

  function setSending(form, sending) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = sending;
    button.textContent = sending ? form.dataset.sendingText : form.dataset.defaultText;
  }

  async function submitContact(form) {
    const endpoint = form.dataset.endpoint || '/api/contact';
    const payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      message: form.elements.message.value.trim(),
      page: window.location.href
    };

    if (!payload.name || !payload.email || !payload.message) {
      setStatus(form, 'error', form.dataset.requiredText);
      return;
    }

    setSending(form, true);
    setStatus(form, '', '');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Contact endpoint failed');
      }

      form.reset();
      setStatus(form, 'success', form.dataset.successText);
    } catch (error) {
      setStatus(form, 'error', form.dataset.errorText);
    } finally {
      setSending(form, false);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-contact-form]').forEach(function (form) {
      form.dataset.defaultText = form.querySelector('button[type="submit"]').textContent;
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        submitContact(form);
      });
    });
  });
})();
