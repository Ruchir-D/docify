export type TemplateId = 'document' | 'resume' | 'deck' | 'interactive'
export type TemplateChoice = TemplateId | 'auto'

export interface Document {
  id: string
  slug: string
  title: string
  html_content: string
  page_count: number
  created_at: string
  view_count: number
  template: TemplateId
}

export interface Upload {
  id: string
  document_id: string | null
  original_filename: string
  storage_path: string
  created_at: string
}

export type ConversionStatus = 'uploading' | 'converting' | 'done' | 'error'

export interface ConversionStep {
  id: string
  label: string
  sublabel: string
  status: 'pending' | 'active' | 'done'
}

export interface Heading {
  id: string
  text: string
  level: number
}
