/** Every page opens the same way: its section icon, the title, a line of context, then actions. */
export default function PageHeader({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <span className="page-icon">{icon}</span>
      <div className="page-heading">
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
