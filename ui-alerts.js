(function () {
  async function swalConfirm(message, options) {
    if (window.Swal && typeof window.Swal.fire === "function") {
      const result = await window.Swal.fire({
        title: "تأكيد",
        text: message,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "نعم",
        cancelButtonText: "إلغاء",
        ...(options || {}),
      });
      return !!result.isConfirmed;
    }
    return window.confirm(message);
  }

  window.swalConfirm = swalConfirm;
})();
