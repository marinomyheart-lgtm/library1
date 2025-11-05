"use client"
import { useState, useEffect } from 'react'
import { Book as BookIcon, BookOpen, Star, Search, SortDesc, SortAsc, User, Library, RefreshCw, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useViewMode } from "@/components/view-mode-provider"
import { BookCard } from "@/components/book-card"
import { BookTable } from "@/components/book-table"
import { ViewModeToggle } from "@/components/view-mode-toggle"
import { AddBookModal } from "@/components/add-book-modal"
import { supabase } from '@/lib/supabaseClient';
import type { Book, Quote  } from "@/lib/types"  
import { BookDetailsModal } from '@/components/book-details-modal'
import { BookSearchButton } from '@/components/book-search-button'
import { BookTextAnalyzerModal } from '@/components/text-analyzer-modal'

export default function HomePage() {
  const { viewMode } = useViewMode()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedFavorites, setSelectedFavorites] = useState("all")
  const [sortBy, setSortBy] = useState("default")
  const [books, setBooks] = useState<Book[]>([])
  const [quotesMap, setQuotesMap] = useState<Record<number, Quote[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [showAnalyzer, setShowAnalyzer] = useState(false)
  const [showAddBook, setShowAddBook] = useState(false)
  const [prefilledData, setPrefilledData] = useState<any>(null)
  
  // Estados para las opciones (necesarios para el analizador)
  const [authorsOptions, setAuthorsOptions] = useState<{ value: string; label: string; id?: number }[]>([])
  const [genresOptions, setGenresOptions] = useState<{ value: string; label: string; id?: number }[]>([])
  const [seriesOptions, setSeriesOptions] = useState<{ value: string; label: string; id?: number }[]>([])

  const [statsData, setStatsData] = useState({
    totalBooks: 0,
    booksThisYear: 0,
    totalPages: 0,
    averageRating: 0,
  })

  // Función para cargar las opciones necesarias para el analizador
  const fetchOptions = async () => {
    try {
      // Autores
      const { data: authors } = await supabase
        .from("authors")
        .select("id, name")
        .order("name", { ascending: true })
      setAuthorsOptions(authors?.map((a) => ({ value: a.name, label: a.name, id: a.id })) || [])

      // Géneros
      const { data: genres } = await supabase
        .from("genres")
        .select("id, name")
        .order("name", { ascending: true })
      setGenresOptions(genres?.map((g) => ({ value: g.name, label: g.name, id: g.id })) || [])

      // Series
      const { data: series } = await supabase
        .from("series")
        .select("id, name")
        .order("name", { ascending: true })
      setSeriesOptions(series?.map((s) => ({ value: s.name, label: s.name, id: s.id })) || [])
    } catch (error) {
      console.error("Error fetching options:", error)
    }
  }

  // Función para cargar los libros desde Supabase
  const fetchBooks = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('books')
        .select(`*, author:authors (id,name), genres:genres ( id, name ), series:series (id, name)`)
        .order('id', { ascending: false })
      
      if (error) throw error
      
      // Obtener citas
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
      
      if (quotesError) throw quotesError
      
      // Crear el mapa de citas
      const quotesMap = quotesData?.reduce((acc, quote) => {
        if (quote.book_id) {
          if (!acc[quote.book_id]) {
            acc[quote.book_id] = []
          }
          acc[quote.book_id].push(quote)
        }
        return acc
      }, {} as Record<number, Quote[]>)
      
      setBooks(data || [])
      setQuotesMap(quotesMap || {})
      calculateStats(data || [])
    } catch (error) {
      const err = error as Error
      console.error('Error fetching books:', err.message)
    } finally {
      setLoading(false)
    }
  }

  // Función para calcular estadísticas
  const calculateStats = (books: Book[]) => {
    const currentYear = new Date().getFullYear()
    
    const stats = {
      totalBooks: books.length,
      booksThisYear: books.filter(book => {
        const year = book.end_date ? new Date(book.end_date).getFullYear() : null
        return year === currentYear
      }).length,
      totalPages: books.reduce((sum, book) => sum + (book.pages || 0), 0),
      averageRating: books.length > 0 
        ? parseFloat((books.reduce((sum, book) => sum + (book.rating || 0), 0) / books.length).toFixed(1))
        : 0,
    }
    
    setStatsData(stats)
  }
   
  // Función para manejar la selección de libro
  const handleBookSelect = (book: Book) => {
    setSelectedBook(book)
  }

  // Función para actualizar libros
  const handleBookUpdate = (updatedBook: Book) => {
    setBooks(prevBooks => 
      prevBooks.map(book => 
        book.id === updatedBook.id ? updatedBook : book
      )
    )
    // Si el libro actualizado es el seleccionado, actualizarlo también
    if (selectedBook && selectedBook.id === updatedBook.id) {
      setSelectedBook(updatedBook)
    }
  }

  // Función para manejar selección desde búsqueda
  const handleSearchBookSelect = (book: any) => {
    console.log('Libro seleccionado desde búsqueda:', book)
  }

  // Función para manejar la selección desde el analizador de texto
  const handleAnalyzerBookSelect = async (bookData: any) => {
    // 🎯 USAR DIRECTAMENTE LOS DATOS SIN PROCESAMIENTO EXTRA
    setPrefilledData(bookData)
    setShowAnalyzer(false)
    setShowAddBook(true)
  }

  // Cargar libros y opciones al montar el componente
  useEffect(() => {
    fetchBooks()
    fetchOptions()
  }, [])

  const filteredBooks = books
    .filter((book) => {
      const matchesSearch =
        book.title.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesFavorites =
        selectedFavorites === "all" ||
        (selectedFavorites === "favorites" && book.favorite) ||
        (selectedFavorites === "non-favorites" && !book.favorite)

      return matchesSearch && matchesFavorites
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "rating-desc":
          return (b.rating ?? 0) - (a.rating ?? 0)
        case "rating-asc":
          return (a.rating ?? 0) - (b.rating ?? 0)
        case "title":
          return a.title.localeCompare(b.title)
        case "author":
          return (a.author?.name ?? "").localeCompare(b.author?.name ?? "")        
        case "pages-desc":
          return (b.pages ?? 0) - (a.pages ?? 0)
        case "pages-asc":
          return (a.pages ?? 0) - (b.pages ?? 0)
        case "orden-asc":
          return a.orden - b.orden 
        default:  
          return b.orden - a.orden 
      }
    })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-v50">
        <div className="text-center">
          <div className="loading h-12 w-12 border-t-2 border-v500 mx-auto mb-4"></div>
          <p className="text">Loading your library...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-v50">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Add Book Button */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <h1 className="title">My Library</h1>
            <p className="text-v600">Manage and explore your personal book collection</p>
          </div>
          <div className="flex gap-3">
            <BookSearchButton onBookSelect={handleSearchBookSelect} />
            <Button
              onClick={fetchBooks}
              disabled={loading}
              variant="outline"
              className="button-tran"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}/>
            </Button>
            <Button
              onClick={() => setShowAnalyzer(true)}
              variant="outline"
              className="button-tran"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Analyze Text
            </Button>
            <Button
              onClick={() => setShowAddBook(true)}
              className="button1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Book
            </Button>
          </div>
        </div>

        {/* Dashboard Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
            <Card className="card">
            <CardHeader className="card-header">
              <CardTitle className="card-title">Books Read</CardTitle>
              <BookIcon className="icon" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="card-div">{statsData.totalBooks}</div>
              <p className="card-p">+{statsData.booksThisYear} this year</p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader className="card-header">
              <CardTitle className="card-title">Pages Read</CardTitle>
              <BookOpen className="icon" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="card-div">{statsData.totalPages.toLocaleString()}</div>
              <p className="card-p">
                Average: {Math.round(statsData.totalPages / statsData.totalBooks)} per book
              </p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader className="card-header">
              <CardTitle className="card-title">Average Rating</CardTitle>
              <Star className="icon" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="card-div">{statsData.averageRating}</div>
              <p className="card-p">out of 10 points</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search - Redesigned */}
        <div className="mb-0 space-y-4">
          {/* Filters + Search Row */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center justify-between">
            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-v500 z-10 pointer-events-none" />
              <Input
                placeholder="Search by title"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-9 bg-white/30 text-gray-700 backdrop-blur-md border bordes rounded-2xl placeholder:text-gray-500"/>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-v500 hover:text-v700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Favorites */}
              <Select value={selectedFavorites} onValueChange={setSelectedFavorites}>
                <SelectTrigger className="setrigger"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="select-item">
                    <Library className="icons" />
                    All books
                  </SelectItem>
                  <SelectItem value="favorites" className="select-item">
                    <Star className="icons fill-purple-500" />
                    Only favorites
                  </SelectItem>
                  <SelectItem value="non-favorites" className="select-item">
                    <Library className="icons" />
                    Not favorites
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Sort by */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="setrigger"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default" className="select-item">
                    <SortDesc className="icons" />
                    Order (High to low)
                  </SelectItem>
                  <SelectItem value="order-asc" className="select-item">
                    <SortAsc className="icons" />
                    Order (Low to high)
                  </SelectItem>
                  <SelectItem value="rating-desc" className="select-item">
                    <SortDesc className="icons" />
                    Rating (Highest)
                  </SelectItem>
                  <SelectItem value="rating-asc" className="select-item">
                    <SortAsc className="icons" />
                    Rating (Lowest)
                  </SelectItem>
                  <SelectItem value="title" className="select-item">
                    <BookOpen className="icons" />
                    Title (A-Z)
                  </SelectItem>
                  <SelectItem value="author" className="select-item">
                    <User className="icons" />
                    Author (A-Z)
                  </SelectItem>
                  <SelectItem value="pages-desc" className="select-item">
                    <SortDesc className="icons" />
                    Pages (Most)
                  </SelectItem>
                  <SelectItem value="pages-asc" className="select-item">
                    <SortAsc className="icons" />
                    Pages (Least)
                  </SelectItem>
                </SelectContent>
              </Select>
               {/* Clear filters button - Only appears when there are active filters */}
              {(selectedFavorites !== "all" || sortBy !== "default" || searchTerm) && (
                <Button
                  onClick={() => {
                    setSelectedFavorites("all")
                    setSortBy("default")
                  }}
                  variant="outline"
                  size="sm"
                  className="h-9 text-sm bg-white/30 backdrop-blur-md border border-purple-300/30 rounded-2xl pl-5 transition-all duration-300 w-18"
                >
                  <X className="icons" />
                </Button>
              )}
            </div>

            {/* View Toggle */}
            <div className="w-full sm:w-auto">
              <ViewModeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Books Display */}
      <div className="px-4 lg:px-10">
        {/* Books Display */}
        {viewMode === "cards" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-6">
            {filteredBooks.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        ) : (
          <BookTable
            books={filteredBooks}
            quotesMap={quotesMap}
            refreshData={fetchBooks}
            onBookSelect={handleBookSelect}
            onBookUpdate={handleBookUpdate}
          />
        )}

        {/* Book details modal */}
        <BookDetailsModal 
          book={selectedBook}
          isOpen={!!selectedBook}
          onOpenChange={(open) => {if (!open) {setSelectedBook(null)}}}
          quotes={selectedBook ? quotesMap[selectedBook.id] || [] : []}
          onBookUpdate={handleBookUpdate}
          refreshData={fetchBooks}
        />

        {/* Text analyzer modal */}
        <BookTextAnalyzerModal
          isOpen={showAnalyzer}
          onClose={() => setShowAnalyzer(false)}
          onBookSelect={handleAnalyzerBookSelect}
          genresOptions={genresOptions}
          authorsOptions={authorsOptions}
          seriesOptions={seriesOptions}
          setGenresOptions={setGenresOptions}
          setAuthorsOptions={setAuthorsOptions}
          setSeriesOptions={setSeriesOptions}
          onOpenAddBook={handleAnalyzerBookSelect}
        />
        <AddBookModal 
          refreshData={fetchBooks}
          isOpen={showAddBook}
          onOpenChange={setShowAddBook}
          prefilledData={prefilledData}
        />

        {filteredBooks.length === 0 && (
          <Card className="text-center py-12 bg-white/60 backdrop-blur-sm border-0">
            <CardContent>
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No books found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search filters or add a new book to your library.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}