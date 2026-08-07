export default function Badge({ status }) {
  const isAvailable = status === 'available';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        isAvailable ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {isAvailable ? 'Available' : 'Checked Out'}
    </span>
  );
}
