"use client"
import React, { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { MultiSelect } from "@/components/MultiSelect"
import { supabase } from '@/lib/supabaseClient'
import { toast } from "sonner"
import type { Book } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

interface EditableCellProps {
  book: Book
  columnId: string
  value: any
  options: { value: string; label: string; id?: number }[]
  onSave: (newValue?: any) => void
  onCancel: () => void
  refreshOptions?: () => Promise<void>
}

export const EditableCell: React.FC<EditableCellProps> = ({
  book,
  columnId,
  value,
  options,
  onSave,
  onCancel,
  refreshOptions
}) => {
  const [editValue, setEditValue] = useState<any>(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [autoOpenMultiSelect, setAutoOpenMultiSelect] = useState(false)

  // Configuración unificada para todos los tipos de campos
  const fieldConfig = {
    // Campos que se abren automáticamente en popover
    autoOpenPopover: ["dateStarted", "dateRead", "genre", "type", "publisher", "language", "era", "format", "audience", "readingDensity", "author", "universe", "favorite"],
    
    // Campos que son MultiSelect
    multiSelectFields: ["genre", "type", "publisher", "language", "era", "format", "audience", "readingDensity", "author", "universe"],
    
    // Campos que son de selección única
    singleSelectFields: ["type", "publisher", "language", "era", "format", "audience", "readingDensity", "author", "universe", "favorite"],
    
    // Campos que requieren IDs
    idBasedFields: ["author", "universe", "genre"],
    
    // Campos creativos
    creatableFields: ["type", "publisher", "language", "era", "format", "audience", "author", "universe", "genre"]
  }

  useEffect(() => {
    // Abrir automáticamente los popovers para los campos configurados
    if (fieldConfig.autoOpenPopover.includes(columnId)) {
      setIsPopoverOpen(true)
    }

    // Para campos MultiSelect, activar el auto-open después de un pequeño delay
    if (fieldConfig.multiSelectFields.includes(columnId)) {
      const timer = setTimeout(() => {
        setAutoOpenMultiSelect(true)
      }, 100)
      return () => clearTimeout(timer)
    }

    // Para campos de input/textarea normales, enfocar
    if (inputRef.current && !fieldConfig.autoOpenPopover.includes(columnId)) {
      inputRef.current.focus()
    }
    if (textareaRef.current && columnId === "review") {
      textareaRef.current.focus()
    }
  }, [columnId])

  const handleSave = async (newValue?: any, isNewItem: boolean = false) => {
    const valueToSave = newValue !== undefined ? newValue : editValue
    
    try {
      // Validación específica para rating
      if (columnId === "rating") {
        const ratingValue = parseFloat(valueToSave);
        if (ratingValue < 1 || ratingValue > 10) {
          toast.error("La calificación debe estar entre 1 y 10");
          onCancel();
          return;
        }
      }

      const fieldMap: Record<string, string> = {
        title: "title",
        rating: "rating",
        pages: "pages",
        awards: "awards",
        type: "type",
        publisher: "publisher",
        language: "language",
        era: "era",
        format: "format",
        audience: "audience",
        readingDensity: "reading_difficulty",
        favorite: "favorite",
        dateStarted: "start_date",
        dateRead: "end_date",
        year: "year",
        author: "author_id",
        universe: "series_id",
        genre: "genre",
        review: "review",
        image_url: "image_url",
        summary: "summary",
        main_characters: "main_characters", 
        favorite_character: "favorite_character",
      }

      const dbField = fieldMap[columnId]
      if (!dbField) return

      let dbValue = valueToSave

      // Convertir nombres a IDs para campos relacionales
      if (fieldConfig.idBasedFields.includes(columnId) && columnId !== "genre") {
        if (valueToSave) {
          if (isNewItem && refreshOptions) {
            await refreshOptions()
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          
          const option = options.find(opt => opt.value === valueToSave)
          if (option && option.id) {
            dbValue = option.id
          } else {
            const parsedId = parseInt(valueToSave)
            if (!isNaN(parsedId)) {
              dbValue = parsedId
            } else {
              const tableName = getTableName(columnId)
              if (tableName) {
                const { data, error } = await supabase
                  .from(tableName)
                  .select("id")
                  .eq("name", valueToSave)
                  .single()
                
                if (!error && data) {
                  dbValue = data.id
                } else {
                  dbValue = null
                  toast.error(`No se pudo encontrar el ${columnId} "${valueToSave}"`)
                }
              }
            }
          }
        } else {
          dbValue = null
        }
      }

      // Manejo especial para géneros
      if (columnId === "genre") {
        if (Array.isArray(valueToSave)) {
          const validGenreIds = valueToSave
            .map(id => parseInt(id))
            .filter(id => !isNaN(id) && id !== null && id !== undefined)

          const { error: deleteError } = await supabase
            .from("book_genre")
            .delete()
            .eq("book_id", book.id)

          if (deleteError) {
            console.error("Error eliminando relaciones de género:", deleteError)
            throw deleteError
          }

          if (validGenreIds.length > 0) {
            const genreInserts = validGenreIds.map(genreId => ({
              book_id: book.id,
              genre_id: genreId
            }))

            const { error: insertError } = await supabase
              .from("book_genre")
              .insert(genreInserts)

            if (insertError) {
              console.error("Error insertando relaciones de género:", insertError)
            }
          }

          toast.success("Géneros actualizados correctamente")
          onSave(validGenreIds)
          return
        } else {
          toast.error("Formato de géneros inválido")
          onCancel()
          return
        }
      }

      // Conversiones de tipo
      if (columnId === "rating") dbValue = parseFloat(valueToSave)
      if (columnId === "pages" || columnId === "year") dbValue = parseInt(valueToSave)
      if (columnId === "favorite") dbValue = Boolean(valueToSave)
      if (columnId === "dateStarted" || columnId === "dateRead") {
        dbValue = valueToSave 
      }

      if (columnId !== "genre") {
        const { error } = await supabase
          .from("books")
          .update({ [dbField]: dbValue })
          .eq("id", book.id)

        if (error) throw error
      }

      toast.success(`Campo ${columnId} actualizado`)
      onSave(dbValue)
      setIsPopoverOpen(false)
    } catch (error) {
      console.error("Error updating field:", error)
      toast.error(`No se pudo actualizar el campo ${columnId}`)
      onCancel()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === "Escape") {
      onCancel()
      setIsPopoverOpen(false)
    }
  }

  const getTableName = (columnId: string) => {
    switch (columnId) {
      case "author": return "authors"
      case "universe": return "series"
      case "genre": return "genres"
      default: return undefined
    }
  }

  // Función para manejar cambios en MultiSelect
  const handleMultiSelectChange = (selected: string[], newItem?: { value: string; label: string; id?: number }) => {
    const newValue = selected[0] || null
    setEditValue(newValue)
    handleSave(newValue, !!newItem)
  }

  // Función específica para géneros
  const handleGenreChange = (selected: string[], newItem?: { value: string; label: string; id?: number }) => {
    setEditValue(selected)
  }

  // Función específica para autor/universo
  const handleAuthorUniverseChange = async (selected: string[], newItem?: { value: string; label: string; id?: number }) => {
    const newValue = selected[0] || null
    setEditValue(newValue)
    if (newItem && newItem.id) {
      handleSave(newItem.id.toString(), true)
    } else {
      handleSave(newValue, false)
    }
  }

  // Preparar los valores seleccionados para el MultiSelect de géneros
  const getSelectedGenreValues = () => {
    if (columnId !== "genre") return editValue ? [editValue] : []
    
    if (Array.isArray(editValue)) {
      return editValue.map(id => id.toString())
    }
    return editValue ? [editValue.toString()] : []
  }

  // Preparar las opciones para el MultiSelect de géneros
  const getGenreOptions = () => {
    return options.map(option => ({
      value: option.id?.toString() || option.value,
      label: option.label,
      id: option.id
    }))
  }

  // COMPONENTE UNIFICADO PARA POPOVERS
  const renderPopoverContent = () => {
    switch (columnId) {
      case "dateStarted":
      case "dateRead":
        return (
          <div className="p-0 -m-px">
            <Calendar
              value={editValue} // ← String directamente
              onChange={(dateString) => { // ← Recibe string
                setEditValue(dateString)
                handleSave(dateString)
              }}
              onClear={() => {
                setEditValue(null)
                handleSave(null)
              }}
            />    
          </div>
        )

      case "genre":
        return (
          <div className="p-2">
            <MultiSelect
              options={getGenreOptions()}
              selected={getSelectedGenreValues()}
              onChange={handleGenreChange}
              singleSelect={false}
              className="text-sm"
              placeholder="Selecciona géneros"
              tableName="genres"
              returnId={true}
              refreshOptions={refreshOptions}
              creatable={true}
              columnId={columnId}
              autoOpen={autoOpenMultiSelect}
            />
            <div className="p-1 border-t flex justify-end gap-1 text-xs mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 border-violet-300 text-violet-400 hover:bg-violet-100 text-xs"
                onClick={onCancel}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 bg-violet-200 text-violet-700 hover:bg-violet-300 text-xs"
                onClick={() => handleSave(editValue)}
              >
                Guardar
              </Button>
            </div>
          </div>
        )

      case "type":
      case "publisher":
      case "language":
      case "era":
      case "format":
      case "audience":
      case "readingDensity":
        return (
          <div className="p-2">
            <MultiSelect
              options={options}
              selected={editValue ? [editValue] : []}
              onChange={handleMultiSelectChange}
              singleSelect={true}
              className="text-sm"
              placeholder={`Selecciona ${columnId}`}
              creatable={fieldConfig.creatableFields.includes(columnId)}
              columnId={columnId}
              autoOpen={autoOpenMultiSelect}
            />
          </div>
        )

      case "author":
      case "universe":
        return (
          <div className="p-2">
            <MultiSelect
              options={options}
              selected={editValue ? [editValue] : []}
              onChange={handleAuthorUniverseChange}
              singleSelect={true}
              className="text-sm"
              placeholder={`Selecciona ${columnId === 'universe' ? 'un universo' : columnId}`}
              tableName={getTableName(columnId)}
              returnId={true}
              creatable={true}
              columnId={columnId}
              autoOpen={autoOpenMultiSelect}
            />
          </div>
        )

      case "favorite":
        return (
          <div className="p-3">
            <select
              value={editValue ? "true" : "false"}
              onChange={(e) => {
                const newValue = e.target.value === "true"
                setEditValue(newValue)
                handleSave(newValue)
              }}
              className="w-full text-sm px-2 py-1 rounded-md bg-violet-50 border border-violet-200 text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 hover:bg-violet-100 transition-colors"
              autoFocus
            >
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
        )

      default:
        return null
    }
  }

  // COMPONENTE UNIFICADO PARA POPOVER
  const renderAutoOpenPopover = () => (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <div className="absolute inset-0 opacity-0" />
      </PopoverTrigger>
      <PopoverContent 
        className={cn(
          "z-[1000] p-0",
          columnId === "favorite" ? "w-32" : 
          ["dateStarted", "dateRead"].includes(columnId) ? "w-auto" : "min-w-[250px]"
        )}
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={16}
      >
        {renderPopoverContent()}
      </PopoverContent>
    </Popover>
  )

  // Renderizado de campos normales (no popover)
  const renderNormalField = () => {
    switch (columnId) {
      case "title":
      case "awards":
      case "image_url":
        return (
          <Input
            value={editValue || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="absolute z-50 w-[250px] text-xs px-2 py-1 h-7 bg-white shadow-sm"
            ref={inputRef}
          />
        )

      case "rating":
      case "pages":
      case "year":
        return (
          <Input
            type="number"
            min={columnId === "rating" ? "1" : "1"}
            max={columnId === "rating" ? "10" : undefined}
            step={columnId === "rating" ? "1" : "1"}
            value={editValue || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="absolute z-50 w-[75px] text-xs px-2 py-1 h-7 bg-white shadow-sm"
            ref={inputRef}
          />
        )

      case "summary":
        return (
          <div className="absolute z-50 bg-white rounded-md border p-2 w-[600px]">
            <Textarea
              value={editValue || ""}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  e.preventDefault()
                  handleSave()
                }
                if (e.key === "Escape") {
                  onCancel()
                }
              }}
              className="w-full text-xs px-2 py-1 bg-white min-h-[400px] resize-none border-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Escribe el resumen del libro..."
              ref={textareaRef}
            />
            <div className="p-1 border-t flex justify-end gap-1 text-xs mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 border-violet-300 text-violet-400 hover:bg-violet-100 text-xs"
                onClick={onCancel}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 bg-violet-200 text-violet-700 hover:bg-violet-300 text-xs"
                onClick={() => handleSave()}
              >
                Guardar
              </Button>
            </div>
          </div>
        )

      case "review":
        return (
          <div className="absolute z-50 bg-white rounded-md border p-2 w-[300px]">
            <Textarea
              value={editValue || ""}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  e.preventDefault()
                  handleSave()
                }
                if (e.key === "Escape") {
                  onCancel()
                }
              }}
              className="w-full text-xs px-2 py-1 bg-white min-h-[100px] resize-none border-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Escribe tu reseña..."
              ref={textareaRef}
            />
            <div className="p-1 border-t flex justify-end gap-1 text-xs mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 border-violet-300 text-violet-400 hover:bg-violet-100 text-xs"
                onClick={onCancel}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 bg-violet-200 text-violet-700 hover:bg-violet-300 text-xs"
                onClick={() => handleSave()}
              >
                Guardar
              </Button>
            </div>
          </div>
        )

      case "main_characters":
      case "favorite_character":
        return (
          <Input
            value={editValue || ""}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleSave()
              }
              if (e.key === "Escape") {
                onCancel()
              }
            }}
            className="text-sm"
            ref={inputRef}
          />
        )

      default:
        return null
    }
  }

  // RENDER PRINCIPAL
  if (fieldConfig.autoOpenPopover.includes(columnId)) {
    return (
      <div className="absolute z-50">
        {renderAutoOpenPopover()}
      </div>
    )
  }

  return renderNormalField()
}