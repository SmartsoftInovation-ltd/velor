import { ReactNode, CSSProperties } from "react";

// Props for Table
interface TableProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Props for TableHeader
interface TableHeaderProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Props for TableBody
interface TableBodyProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Props for TableRow
interface TableRowProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Props for TableCell
interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
  isHeader?: boolean;
  className?: string;
  style?: CSSProperties;
}

// Table Component
const Table: React.FC<TableProps> = ({ children, className, style }) => {
  return <table className={`min-w-full ${className}`} style={style}>{children}</table>;
};

// TableHeader Component
const TableHeader: React.FC<TableHeaderProps> = ({ children, className, style }) => {
  return <thead className={className} style={style}>{children}</thead>;
};

// TableBody Component
const TableBody: React.FC<TableBodyProps> = ({ children, className, style }) => {
  return <tbody className={className} style={style}>{children}</tbody>;
};

// TableRow Component
const TableRow: React.FC<TableRowProps> = ({ children, className, style }) => {
  return <tr className={className} style={style}>{children}</tr>;
};

// TableCell Component
const TableCell: React.FC<TableCellProps> = ({
  children,
  isHeader = false,
  className,
  style,
  ...props
}) => {
  const CellTag = isHeader ? "th" : "td";
  return <CellTag className={`${className}`} style={style} {...props}>{children}</CellTag>;
};

export { Table, TableHeader, TableBody, TableRow, TableCell };
