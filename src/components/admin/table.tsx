export function DataTable({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-eco-50 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="p-6 text-center text-ink-soft">{empty}</p>}
    </div>
  );
}
export const Td = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
