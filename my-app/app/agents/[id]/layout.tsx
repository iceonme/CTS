export function generateStaticParams() {
  return [
    { id: "pa" },
    { id: "tech-analyst" },
    { id: "polymarket-analyst" },
  ];
}

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
