// app/genres/[slug]/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { BookOpen, TrendingUp, LayoutList, Rows3, GripHorizontal, Search, ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabaseClient"
import type { Book, Genre } from "@/lib/types"
import Link from "next/link"
import { BookListView } from "@/components/genres/book-list-view"
import { BookGridExpanded } from "@/components/genres/book-grid-expanded"
import { BookCarouselView } from "@/components/genres/book-carousel-view"

type ViewMode = "list" | "grid-expanded" | "carousel"

export default function GenreBooksPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [genre, setGenre] = useState<Genre | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("grid-expanded")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGenreData()
  }, [slug])

  useEffect(() => {
    filterBooks()
  }, [books, searchQuery])

  const fetchGenreData = async () => {
    try {
      setLoading(true)
      
      // Obtener el género por nombre (convertir slug a nombre)
      const genreName = slug.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')

      // Obtener el género con sus libros
      const { data: genres, error } = await supabase
      .from('genres')
      .select(`
        id,
        name,
        description,
        book_genre(
          book:books(
            id,
            title,
            rating,
            pages,
            year,
            publisher,
            favorite,
            summary,
            review,
            image_url,
            author:author_id(
              id,
              name
            ),
            genres(
              id,
              name
            )
          )
        )
      `)
      .eq('name', genreName)

      if (error) {
        console.error("Error fetching genre:", error)
        return
      }

      if (genres && genres.length > 0) {
        const genreData = genres[0]
        setGenre(genreData)
        
        // Extraer y transformar los libros
        const booksData = genreData.book_genre?.map((bg: any) => ({
          ...bg.book,
          author: bg.book.author,
          genres: bg.book.genres,
          series: bg.book.series
        })) || []
        
        setBooks(booksData)
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterBooks = () => {
    if (!searchQuery.trim()) {
      setFilteredBooks(books)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = books.filter(book => 
      book.title.toLowerCase().includes(query) ||
      book.author?.name.toLowerCase().includes(query) ||
      book.summary?.toLowerCase().includes(query) ||
      book.review?.toLowerCase().includes(query)
    )
    setFilteredBooks(filtered)
  }

  const buttonClass = (mode: ViewMode) => 
    `transition-all ${viewMode === mode ? "bg-pink-600 text-white border-pink-600" : "bg-transparent border-pink-200 text-pink-700 hover:bg-pink-50"}`

  // Calcular estadísticas
  const totalBooks = books.length
  const avgRating = totalBooks > 0 
    ? Number((books.reduce((sum, book) => sum + (book.rating || 0), 0) / totalBooks).toFixed(1))
    : 0
  const favoriteBooks = books.filter(book => book.favorite).length
  const totalPages = books.reduce((sum, book) => sum + (book.pages || 0), 0)
  const bestRatedBook = totalBooks > 0 
    ? Math.max(...books.map(book => book.rating || 0))
    : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fcf1f6" }}>
        <div className="text-center">
          <div className="h-12 w-12 border-t-2 border-pink-500 border-pink-200 rounded-full mx-auto mb-4 animate-spin"></div>
          <p className="text-pink-600">Cargando libros...</p>
        </div>
      </div>
    )
  }

  if (!genre) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#fcf1f6" }}>
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-pink-400 mb-4" />
                <h3 className="text-lg font-semibold text-pink-800 mb-2">Género no encontrado</h3>
                <p className="text-pink-600">El género que buscas no existe en tu biblioteca.</p>
                <Link href="/genres">
                  <Button className="mt-4 bg-pink-600 hover:bg-pink-700 text-white">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a Géneros
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fcf1f6" }}>
      <div className="container mx-auto px-4 py-8">
        {/* Header con Botón de Regreso */}
        <div className="flex items-center gap-4 mb-2">
          <Link href="/genres">
            <Button variant="outline" className="bg-transparent border-pink-200 text-pink-700 hover:bg-pink-100">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Géneros
            </Button>
          </Link>
        </div>

        {/* Header del Género */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 mb-2 h-24 flex flex-col justify-center">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl text-pink-800">{genre.name}</CardTitle>
                <CardDescription className="text-lg mt-2 text-pink-600">{genre.description}</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-pink-100 text-pink-800 text-lg px-4 py-2 pointer-events-none">
                {totalBooks} {totalBooks === 1 ? 'libro' : 'libros'}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Controles de Vista y Búsqueda */}
        <div className="mb-2">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            {/* Búsqueda */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 h-5 w-5 z-10 pointer-events-none" />
              <Input
                placeholder="Buscar libros..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 bg-white/30 backdrop-blur-sm border-pink-200 rounded-xl text-pink-800 placeholder-pink-400 focus:ring-pink-300"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-pink-500 hover:text-pink-700"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Controles de Vista */}
            <div className="flex items-center gap-2">              
              {/* List View */}
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={buttonClass("list")}
                title="Lista"
              >
                <LayoutList className="h-4 w-4" />
              </Button>

              {/* Grid Expanded View */}
              <Button
                variant={viewMode === "grid-expanded" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid-expanded")}
                className={buttonClass("grid-expanded")}
                title="Grid Expandido"
              >
                <Rows3 className="h-4 w-4" />
              </Button>

              {/* Carousel View */}
              <Button
                variant={viewMode === "carousel" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("carousel")}
                className={buttonClass("carousel")}
                title="Carrusel"
              >
                <GripHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Vista de Libros */}
        {filteredBooks.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 mx-auto text-pink-400 mb-4" />
            <h3 className="text-lg font-semibold text-pink-800 mb-2">
              {searchQuery ? "No se encontraron libros" : "No hay libros en este género"}
            </h3>
            <p className="text-pink-600">
              {searchQuery 
                ? "Intenta con otros términos de búsqueda."
                : "Agrega algunos libros a este género para verlos aquí."
              }
            </p>
          </div>
        ) : (
          <>
            {viewMode === "list" && <BookListView books={filteredBooks} />}
            {viewMode === "grid-expanded" && <BookGridExpanded books={filteredBooks} />}
            {viewMode === "carousel" && <BookCarouselView books={filteredBooks} />}
          </>
        )}

        {/* Tendencias del Género */}
        <Card className="mt-2 bg-white/80 backdrop-blur-sm border-0 ">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-pink-800">
              <TrendingUp className="h-5 w-5" />
              Estadísticas de {genre.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-pink-600">
                <p>
                  • <strong>{favoriteBooks} libros</strong> marcados como favoritos en este género
                </p>
                <p>
                  • El libro mejor calificado tiene <strong>{bestRatedBook}/10</strong> puntos
                </p>
                <p>
                  • Has leído <strong>{totalPages} páginas</strong> en total de este género
                </p>
                <p>
                  • Rating promedio: <strong>{avgRating}/10</strong> estrellas
                </p>
                <p>
                  • Representa el <strong>{((totalBooks / 50) * 100).toFixed(1)}%</strong> de tu biblioteca total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}