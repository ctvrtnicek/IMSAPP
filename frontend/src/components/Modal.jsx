/**
 * Modal — reusable centered overlay dialog.
 *
 * Props:
 *   title    - string shown in header
 *   onClose  - fn called when X button or backdrop clicked
 *   children - modal body content
 */
export default function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 rounded-t-2xl flex-shrink-0"
          style={{ backgroundColor: 'var(--cadet-dark)' }}
        >
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white text-xl leading-none transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
