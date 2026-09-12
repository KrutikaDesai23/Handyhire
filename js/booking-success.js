(function () {
    'use strict';

    if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;

    function readLastBooking() {
        try {
            var raw = sessionStorage.getItem('handyhire.lastBooking');
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (error) {
            return null;
        }
    }

    function formatMoney(value) {
        var number = Number(value);
        return Number.isFinite(number) ? '₹' + number.toLocaleString('en-IN') : '—';
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function init() {
        var summary = readLastBooking();
        if (!summary) return;

        var bookingId = summary.bookingId || summary.id || '--';
        var worker = summary.workerName || summary.worker || summary.package_name || 'Professional';
        var date = summary.booking_date || summary.date || '--';
        var time = summary.booking_time || summary.time || '--';
        var amount = summary.amount != null ? summary.amount : summary.total;

        setText('successBookingId', 'Booking ID: ' + bookingId);
        setText('successWorker', worker);
        setText('successSchedule', date + ' • ' + time);
        setText('successAmount', formatMoney(amount));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
