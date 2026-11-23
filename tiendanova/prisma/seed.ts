import { PrismaClient, type Category } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

const products: {
  name: string;
  slug: string;
  description: string;
  category: Category;
  price: number;
  stock: number;
  images: string[];
}[] = [
  {
    name: "Lámpara de escritorio Aura",
    slug: "lampara-aura",
    description:
      "Luz cálida y dirigida para leer al anochecer. El cuerpo compacto deja espacio para tu cuaderno y las cosas que usas a diario.",
    category: "LIGHTING",
    price: 34990,
    stock: 15,
    images: ["lamp", "workspace"],
  },
  {
    name: "Teclado mecánico Forma",
    slug: "teclado-forma",
    description:
      "Un teclado compacto con una respuesta táctil precisa y un perfil bajo. Ideal para escritorios pequeños y largas sesiones de escritura.",
    category: "DESK",
    price: 64990,
    stock: 12,
    images: ["keyboard", "workspace"],
  },
  {
    name: "Audífonos Modo",
    slug: "audifonos-modo",
    description:
      "Sonido equilibrado con un diseño envolvente. Las almohadillas suaves acompañan horas de concentración o música.",
    category: "ACCESSORIES",
    price: 54990,
    stock: 8,
    images: ["headphones"],
  },
  {
    name: "Mouse inalámbrico Trazo",
    slug: "mouse-trazo",
    description:
      "Compacto, preciso y fácil de llevar. Su diseño discreto combina con cualquier estación de trabajo.",
    category: "ACCESSORIES",
    price: 24990,
    stock: 18,
    images: ["mouse"],
  },
  {
    name: "Cuaderno Mapa",
    slug: "cuaderno-mapa",
    description:
      "Páginas gruesas y cubierta rígida para organizar ideas, tomar notas y preparar el trabajo de la semana.",
    category: "DESK",
    price: 11990,
    stock: 24,
    images: ["notebook"],
  },
  {
    name: "Portátil Studio",
    slug: "portatil-studio",
    description:
      "Equipo ligero pensado para viajar y trabajar con comodidad. Acabado mate y bisagra de apertura sencilla.",
    category: "DESK",
    price: 729990,
    stock: 3,
    images: ["laptop", "workspace"],
  },
  {
    name: "Set escritorio Línea",
    slug: "set-escritorio-linea",
    description:
      "Selección de complementos para organizar cables, papeles y accesorios del escritorio.",
    category: "DESK",
    price: 42990,
    stock: 10,
    images: ["workspace", "notebook"],
  },
  {
    name: "Lámpara de lectura Bruma",
    slug: "lampara-bruma",
    description:
      "Un punto de luz suave para la última lectura de la noche. Su brazo permite dirigir el haz a la altura que necesitas.",
    category: "LIGHTING",
    price: 29990,
    stock: 7,
    images: ["lamp"],
  },
];

async function main() {
  for (const product of [...products].reverse()) {
    await db.product.upsert({
      where: { slug: product.slug },
      create: {
        ...product,
        images: product.images.map((file) => `/products/${file}.jpg`),
      },
      // Preserve administrator changes and the stock remaining after repeated runs.
      update: {},
    });
  }
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email || password) {
    if (
      !email ||
      !password ||
      password.length < 10 ||
      new TextEncoder().encode(password).length > 72
    ) {
      throw new Error(
        "Configura SEED_ADMIN_EMAIL y una contraseña de 10 a 72 bytes.",
      );
    }
    const existing = await db.user.findUnique({
      where: { email },
      select: { role: true },
    });
    if (existing?.role === "CUSTOMER")
      throw new Error(
        "El correo de administrador ya pertenece a una cuenta de cliente.",
      );
    if (!existing) {
      await db.user.create({
        data: {
          email,
          name: "Administración Nova",
          passwordHash: await hash(password, 12),
          role: "ADMIN",
        },
      });
    }
  }
  console.log("Catálogo de demostración disponible.");
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
