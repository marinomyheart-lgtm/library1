// app/genres/page.tsx
import { BookOpen, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { getGenreColor } from "@/lib/colors"

// Función para obtener datos de géneros desde Supabase
async function getGenresData() {
  try {
    // Obtener todos los géneros con sus libros y descripción
    const { data: genres, error: genresError } = await supabase
      .from('genres')
      .select(`
        id,
        name,
        description,
        book_genre(
          book:books(
            id,
            title,
            rating
          )
        )
      `)

    if (genresError) {
      console.error("Error fetching genres:", genresError)
      return []
    }

    // Procesar los datos para el formato del componente
    const processedGenres = genres?.map(genre => {
      // Extraer los libros del formato de relación de Supabase
      const books = genre.book_genre?.map((bg: any) => bg.book) || []
      const bookCount = books.length
      
      // Calcular rating promedio
      const validRatings = books.filter((book: any) => book.rating !== null && book.rating !== undefined)
      const avgRating = validRatings.length > 0 
        ? Number((validRatings.reduce((sum: number, book: any) => sum + Number(book.rating), 0) / validRatings.length).toFixed(1))
        : 0

      // Obtener libros destacados
      const featuredBooks = books
        .slice(0, 4)
        .map((book: any) => book.title)

      return {
        id: genre.id,
        name: genre.name,
        slug: genre.name.toLowerCase().replace(/\s+/g, '-'),
        count: bookCount,
        percentage: 0, // Se calculará después
        color: getGenreColor(genre.name), // Usando la función importada
        description: genre.description || "Colección diversa de libros", // Desde la BD
        books: featuredBooks,
        avgRating,
      }
    }).filter(genre => genre.count > 0) || []

    // Calcular porcentajes después de tener todos los géneros
    const totalBooks = processedGenres.reduce((sum, genre) => sum + genre.count, 0)
    const genresWithPercentages = processedGenres.map(genre => ({
      ...genre,
      percentage: totalBooks > 0 ? Math.round((genre.count / totalBooks) * 100) : 0
    })).sort((a, b) => b.count - a.count) // Ordenar por cantidad de libros

    return genresWithPercentages

  } catch (error) {
    console.error("Error fetching genres:", error)
    return []
  }
}

export default async function Genres() {
  const genresData = await getGenresData()

  // Calcular estadísticas generales
  const totalGenres = genresData.length
  const favoriteGenre = genresData[0] || { name: "Ninguno", count: 0 }
  const bestRatedGenre = genresData.reduce((best, current) => 
    current.avgRating > best.avgRating ? current : best, 
    { avgRating: 0, name: "Ninguno" }
  )

  if (totalGenres === 0) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#fcf1f6" }}>
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-pink-400 mb-4" />
                <h3 className="text-lg font-semibold text-pink-800 mb-2">No hay géneros disponibles</h3>
                <p className="text-pink-600">Agrega algunos libros a tu biblioteca para ver las estadísticas por género.</p>
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
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-pink-700">Total de Géneros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-800">{totalGenres}</div>
              <p className="text-sm text-pink-600">géneros explorados</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-pink-700">Género Favorito</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-pink-800">{favoriteGenre.name}</div>
              <p className="text-sm text-pink-600">{favoriteGenre.count} libros leídos</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-pink-700">Mejor Calificado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-pink-800">{bestRatedGenre.name}</div>
              <p className="text-sm text-pink-600">{bestRatedGenre.avgRating} ⭐ promedio</p>
            </CardContent>
          </Card>
        </div>

        {/* Genres Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {genresData.map((genre) => (
            <Card
              key={genre.id}
              className="group hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm border-0 overflow-hidden"
            >
              <div className={`h-2`} style={{ backgroundColor: genre.color }} />

              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl group-hover:text-pink-600 transition-colors">{genre.name}</CardTitle>
                  <Badge variant="secondary" className="bg-pink-100 text-pink-800">
                    {genre.count} libros
                  </Badge>
                </div>
                <CardDescription className="text-sm">{genre.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Porcentaje de tu biblioteca</span>
                    <span className="text-muted-foreground">{genre.percentage}%</span>
                  </div>
                  <Progress value={genre.percentage} className="h-2" />
                </div>

                {/* Rating */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Calificación promedio</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold">{genre.avgRating}</span>
                    <span className="text-yellow-500">⭐</span>
                  </div>
                </div>

                {/* Sample Books */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Libros destacados:</span>
                  <div className="flex flex-wrap gap-1">
                    {genre.books.slice(0, 3).map((book, bookIndex) => (
                      <Badge key={bookIndex} variant="outline" className="text-xs">
                        {book}
                      </Badge>
                    ))}
                    {genre.books.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{genre.books.length - 3} más
                      </Badge>
                    )}
                  </div>
                </div>

                {/* View All Button */}
                <Link href={`/genres/${genre.slug}`}>
                  <Button
                    variant="outline"
                    className="w-full mt-4 group-hover:bg-pink-50 group-hover:border-pink-200 bg-transparent border-pink-200 text-pink-700 hover:bg-pink-50"
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Ver todos los libros
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Genre Trends */}
        <Card className="mt-8 bg-white/80 backdrop-blur-sm border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-pink-800">
              <TrendingUp className="h-5 w-5" />
              Tendencias de Lectura
            </CardTitle>
            <CardDescription>Análisis de tus preferencias de género a lo largo del tiempo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>
                  • Has explorado <strong>{totalGenres} géneros diferentes</strong> en tu biblioteca
                </p>
                <p>
                  • Tu género favorito es <strong>{favoriteGenre.name}</strong> con {favoriteGenre.count} libros
                </p>
                <p>
                  • El género mejor calificado es <strong>{bestRatedGenre.name}</strong> con {bestRatedGenre.avgRating} estrellas promedio
                </p>
                <p>• Tienes una distribución equilibrada entre ficción y no ficción</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}