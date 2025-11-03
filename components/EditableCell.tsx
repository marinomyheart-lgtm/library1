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
  import { CalendarIcon, X } from "lucide-react"
  import { cn } from "@/lib/utils"
  import { format } from "date-fns"

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
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
    const [autoOpenMultiSelect, setAutoOpenMultiSelect] = useState(false)

    // Determinar qué campos deben abrir el MultiSelect automáticamente
    const isMultiSelectField = [
      "genre", "type", "publisher", "language", "era", 
      "format", "audience", "readingDensity", "author", "universe"
    ].includes(columnId)

    useEffect(() => {
      // Para campos MultiSelect, activar el auto-open después de un pequeño delay
      if (isMultiSelectField) {
        const timer = setTimeout(() => {
          setAutoOpenMultiSelect(true)
        }, 100)
        return () => clearTimeout(timer)
      }

      // Para otros campos, enfocar normalmente
      if (inputRef.current && !["dateStarted", "dateRead"].includes(columnId)) {
        inputRef.current.focus()
      }
      if (textareaRef.current && columnId === "review") {
        textareaRef.current.focus()
      }
    }, [columnId, isMultiSelectField])

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
        if (columnId === "author" || columnId === "universe") {
          if (valueToSave) {
            // Si es un nuevo item, refrescar opciones primero
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

        // Manejo especial para géneros - ahora recibimos IDs directamente del MultiSelect
        if (columnId === "genre") {
          if (Array.isArray(valueToSave)) {
            // Filtrar IDs válidos
            const validGenreIds = valueToSave
              .map(id => parseInt(id))
              .filter(id => !isNaN(id) && id !== null && id !== undefined)

            // Eliminar relaciones existentes
            const { error: deleteError } = await supabase
              .from("book_genre")
              .delete()
              .eq("book_id", book.id)

            if (deleteError) {
              console.error("Error eliminando relaciones de género:", deleteError)
              throw deleteError
            }

            // Crear nuevas relaciones si hay géneros válidos
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
            // Si no es un array, manejar como valor único
            toast.error("Formato de géneros inválido")
            onCancel()
            return
          }
        }

        if (columnId === "rating") dbValue = parseFloat(valueToSave)
        if (columnId === "pages" || columnId === "year") dbValue = parseInt(valueToSave)
        if (columnId === "favorite") dbValue = Boolean(valueToSave)
        if (columnId === "dateStarted" || columnId === "dateRead") {
          dbValue = valueToSave ? new Date(valueToSave).toISOString() : null
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
      // No guardamos automáticamente para géneros, esperamos que el usuario presione "Guardar"
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
      
      // Para géneros, necesitamos convertir los IDs a strings para el MultiSelect
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

    // Renderizar MultiSelect con auto-open
    const renderMultiSelect = (props: any = {}) => (
      <div className="absolute z-50 bg-white shadow-lg rounded-md border min-w-[250px]">
        <MultiSelect
          options={props.options || options}
          selected={props.selected || (editValue ? [editValue] : [])}
          onChange={props.onChange || handleMultiSelectChange}
          singleSelect={props.singleSelect !== false}
          className="text-sm p-2"
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder || `Selecciona ${columnId}`}
          tableName={props.tableName}
          returnId={props.returnId}
          refreshOptions={refreshOptions}
          creatable={props.creatable !== false}
          columnId={columnId}
          autoOpen={autoOpenMultiSelect} // ← Esta es la clave
        />
        {props.showButtons && (
          <div className="p-1 border-t flex justify-end gap-1 text-xs">
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
        )}
      </div>
    )
    const renderTextarea = (width: string, minHeight: string, placeholder?: string) => (
      <div 
        className={`absolute z-50 bg-white rounded-md border p-2 ${width}`}
      >
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
          className={`w-full text-xs px-2 py-1 bg-white ${minHeight} resize-none border-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0`}
          placeholder={placeholder}
          ref={textareaRef}
        />
        {/* BOTONES */}
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

      case "dateStarted":
      case "dateRead":
        return (
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <div className="absolute z-50">
                <Button
                  variant="outline"
                  className={cn(
                    "w-[250px] justify-start text-left font-normal",
                    !editValue && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {editValue ? format(new Date(editValue), "PPP") : <span>Selecciona una fecha</span>}
                </Button>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <div className="flex items-center gap-2 p-2">
                <Calendar
                  mode="single"
                  selected={editValue ? new Date(editValue) : undefined}
                  onSelect={(date) => {
                    setEditValue(date?.toISOString())
                    handleSave(date?.toISOString())
                    setIsDatePickerOpen(false)
                  }}
                  initialFocus
                />
                {editValue && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                    onClick={() => {
                      setEditValue(null)
                      handleSave(null)
                      setIsDatePickerOpen(false)
                    }}
                    title="Eliminar fecha"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )

      case "genre":
        return renderMultiSelect({
          options: getGenreOptions(),
          selected: getSelectedGenreValues(),
          onChange: handleGenreChange,
          placeholder: "Selecciona géneros",
          tableName: "genres",
          returnId: true,
          creatable: true,
          showButtons: true
        })

      case "type":
      case "publisher":
      case "language":
      case "era":
      case "format":
      case "audience":
      case "readingDensity":
        return renderMultiSelect({
          singleSelect: true,
          creatable: true
        })

      case "author":
      case "universe":
        return renderMultiSelect({
          singleSelect: true,
          placeholder: `Selecciona ${columnId === 'universe' ? 'un universo' : columnId}`,
          tableName: getTableName(columnId),
          returnId: true,
          creatable: true,
          onChange: handleAuthorUniverseChange
        })

      // ... (el resto de los casos permanece igual)
      case "favorite":
        return (
          <div className="absolute z-50 bg-white shadow-md rounded-lg border border-violet-200 p-2 w-[150px]">
            <select
              value={editValue ? "true" : "false"}
              onChange={(e) => {
                const newValue = e.target.value === "true"
                setEditValue(newValue)
                handleSave(newValue)
              }}
              className="w-full text-sm px-2 py-1 rounded-md bg-violet-50 border border-violet-200 text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 hover:bg-violet-100 transition-colors"
              ref={inputRef as any}
              onKeyDown={handleKeyDown}
            >
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
        )
      case "summary":
        return renderTextarea("w-[600px]", "min-h-[400px]", "Escribe el resumen del libro...")

      case "review":
        return renderTextarea("w-[300px]", "min-h-[100px]", "Escribe tu reseña...")

      case "main_characters":
      case "favorite_character":
        return (
          <div className="absolute z-50 bg-white shadow-lg rounded-md border p-2 w-[300px]">
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
          </div>
        )

      default:
        return null
    }
  }