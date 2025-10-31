// components/QuotesSection.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/MultiSelect"
import { MarkdownEditor } from "./MarkdownEditor"
import { MarkdownViewer } from "./MarkdownViewer"
import { Edit, Plus, X } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import type { Quote } from "@/lib/types"  

interface QuotesSectionProps {
  quotes: Quote[]
  onQuotesChange: (quotes: Quote[]) => void
  className?: string
}

export function QuotesSection({ quotes, onQuotesChange, className = "" }: QuotesSectionProps) {
  const [quoteInput, setQuoteInput] = useState({
    text: "",
    page: "" as string | number, // Permitir ambos tipos temporalmente
    type: "",
    category: [] as string[],
  })
  const [quoteTypesOptions, setQuoteTypesOptions] = useState<{ value: string; label: string }[]>([])
  const [quoteCategoriesOptions, setQuoteCategoriesOptions] = useState<{ value: string; label: string }[]>([])

  // Cargar opciones de tipos y categorías
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        // Tipos de citas
        const { data: quoteTypes } = await supabase
          .from("quotes")
          .select("type")
          .not("type", "is", null)
          .order("type", { ascending: true })
        const uniqueQuoteTypes = [...new Set(quoteTypes?.map((qt) => qt.type))]
        setQuoteTypesOptions(uniqueQuoteTypes?.map((qt) => ({ value: qt, label: qt })) || [])

        // Categorías de citas
        const { data: quoteCategories } = await supabase
          .from("quotes")
          .select("category")
          .not("category", "is", null)
          .order("category", { ascending: true })
        const uniqueQuoteCategories = [...new Set(quoteCategories?.map((qc) => qc.category))]
        setQuoteCategoriesOptions(uniqueQuoteCategories?.map((qc) => ({ value: qc, label: qc })) || [])
      } catch (error) {
        console.error("Error fetching quote options:", error)
      }
    }

    fetchOptions()
  }, [])

  const addQuote = () => {
    if (quoteInput.text.trim()) {
      const newQuote: Quote = {
        text: quoteInput.text.trim(),
        page: quoteInput.page ? Number(quoteInput.page) : undefined, // Convertir a número
        type: quoteInput.type.trim() || "General",
        category: quoteInput.category.length > 0 ? quoteInput.category.join(", ") : "",
      }
      onQuotesChange([...quotes, newQuote])
      setQuoteInput({ text: "", page: "", type: "", category: [] })
    }
  }

  const removeQuote = (index: number) => {
    onQuotesChange(quotes.filter((_, i) => i !== index))
  }

  const updateQuote = (index: number, updatedQuote: Quote) => {
    const newQuotes = [...quotes]
    newQuotes[index] = updatedQuote
    onQuotesChange(newQuotes)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <Label className="label">Citas Favoritas</Label>
      
      <div className="border bordes rounded-lg p-3 space-y-3">
        {/* Input para nueva cita */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <MarkdownEditor
              value={quoteInput.text}
              onChange={(value) => setQuoteInput((prev) => ({ ...prev, text: value }))}
              placeholder="Escribe la cita (usa Markdown para formato)"
            />
          </div>
          <div className="space-y-2">
            <Input
              type="number"
              value={quoteInput.page}
              onChange={(e) => setQuoteInput((prev) => ({ ...prev, page: e.target.value }))}
              placeholder="Página"
              className="input"
            />
            <MultiSelect
              options={quoteTypesOptions}
              selected={quoteInput.type ? [quoteInput.type] : []}
              onChange={(selected) => setQuoteInput((prev) => ({ ...prev, type: selected[0] || "" }))}
              placeholder="Tipo"
              singleSelect
              creatable
            />
            <MultiSelect
              options={quoteCategoriesOptions}
              selected={quoteInput.category}
              onChange={(selected) => setQuoteInput((prev) => ({ ...prev, category: selected }))}
              placeholder="Categorías"
              creatable
              className="text-sm"
            />
          </div>
        </div>

        <Button 
          type="button" 
          onClick={addQuote} 
          size="sm" 
          className="button2"
        >
          <Plus className="w-4 h-4 mr-1" />
          Agregar Cita
        </Button>

        {/* Lista de citas existentes */}
        {quotes.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {quotes.map((quote, index) => (
              <QuoteItem
                key={index}
                quote={quote}
                index={index}
                onUpdate={(updatedQuote) => updateQuote(index, updatedQuote)}
                onRemove={() => removeQuote(index)}
                typesOptions={quoteTypesOptions}
                categoriesOptions={quoteCategoriesOptions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Componente interno para cada item de cita
interface QuoteItemProps {
  quote: Quote
  index: number
  onUpdate: (quote: Quote) => void
  onRemove: () => void
  typesOptions: { value: string; label: string }[]
  categoriesOptions: { value: string; label: string }[]
}

function QuoteItem({ quote, index, onUpdate, onRemove, typesOptions, categoriesOptions }: QuoteItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editQuote, setEditQuote] = useState(quote)

  const handleSave = () => {
    onUpdate(editQuote)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditQuote(quote)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="bg-v50 p-3 rounded-lg space-y-2">
        <MarkdownEditor
          value={editQuote.text}
          onChange={(value) => setEditQuote(prev => ({ ...prev, text: value }))}
          placeholder="Escribe la cita"
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            value={editQuote.page || ""}
            onChange={(e) => setEditQuote(prev => ({ 
              ...prev, 
              page: e.target.value ? Number(e.target.value) : undefined 
            }))}
            placeholder="Página"
            className="input"
          />
          <MultiSelect
            options={typesOptions}
            selected={editQuote.type ? [editQuote.type] : []}
            onChange={(selected) => setEditQuote(prev => ({ ...prev, type: selected[0] || "" }))}
            placeholder="Tipo"
            singleSelect
            creatable
          />
          <MultiSelect
            options={categoriesOptions}
            selected={editQuote.category ? editQuote.category.split(", ") : []}
            onChange={(selected) => setEditQuote(prev => ({ ...prev, category: selected.join(", ") }))}
            placeholder="Categorías"
            creatable
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" onClick={handleSave} className="button2">
            Guardar
          </Button>
          <Button size="sm" variant="outline" className="button-tran2" onClick={handleCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-v50 p-3 rounded-lg text-sm">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          <MarkdownViewer content={quote.text} />
          <div className="flex gap-2 mt-1 text-xs text-gray-500">
            {quote.page && <span>Página {quote.page}</span>}
            {quote.type && <span>• {quote.type}</span>}
            {quote.category && <span>• {quote.category}</span>}
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            onClick={() => setIsEditing(true)}
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-v500 hover:text-v700"
          >
          <Edit className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={onRemove}
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}