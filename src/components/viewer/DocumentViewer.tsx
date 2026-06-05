interface DocumentViewerProps {
  html: string
}

export function DocumentViewer({ html }: DocumentViewerProps) {
  return (
    <div
      className="doc-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
