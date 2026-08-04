"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export type EditorRicoProps = {
  name: string;
  defaultValue?: string;
  label?: string;
  ayuda?: string;
};

/**
 * El campo oculto ya no vive aquí, sino en el envoltorio: este componente se
 * carga en diferido y, hasta que llegaba su código, el formulario no tenía el
 * campo y guardaba la descripción vacía. Aquí solo se avisa de los cambios.
 */
export type EditorRicoInnerProps = Omit<EditorRicoProps, "name"> & {
  onChange: (html: string) => void;
};

/**
 * Editor de la descripción del evento. El HTML viaja en un input oculto porque
 * `<form action={...}>` no pasa por un manejador de JavaScript: no hay dónde
 * leer `editor.getHTML()` en el envío.
 *
 * Lo que se guarde aquí se sanea en el servidor antes de tocar la base de datos
 * (`src/lib/sanitizar.ts`): este componente no es una barrera de seguridad.
 */
export default function EditorRicoInner({
  defaultValue = "",
  label,
  ayuda,
  onChange,
}: EditorRicoInnerProps) {
  const editor = useEditor({
    // Obligatorio en App Router: sin esto el HTML del servidor y el del cliente
    // no coinciden y React avisa de desajuste de hidratación.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Se limitan a lo que el saneador del servidor deja pasar; permitir más
        // aquí solo llevaría a que el organizador viera desaparecer su formato.
        heading: { levels: [2, 3] },
        codeBlock: false,
        horizontalRule: false,
      }),
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class:
          "prosa max-w-none min-h-40 px-4 py-3 text-sm focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      // Un editor vacío devuelve "<p></p>"; guardarlo llenaría la base de datos
      // de párrafos huecos y la ficha pública mostraría un bloque en blanco.
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
  });

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-sm font-medium text-atenuado">{label}</span>
      )}

      <div className="overflow-hidden rounded-lg border border-linea-fuerte bg-superficie focus-within:border-texto/25">
        {editor && <BarraHerramientas editor={editor} />}
        <EditorContent editor={editor} />
      </div>

      {ayuda && <p className="text-xs text-atenuado">{ayuda}</p>}
    </div>
  );
}

function BarraHerramientas({ editor }: { editor: Editor }) {
  const boton = (activo: boolean) =>
    `rounded px-2.5 py-1 text-sm transition-colors ${ activo ? "bg-naranja/15 text-naranja-suave" : "text-atenuado hover:bg-linea hover:text-texto" }`;

  const acciones = [
    { etiqueta: "N", titulo: "Negrita", activo: editor.isActive("bold"), fn: () => editor.chain().focus().toggleBold().run(), clase: "font-bold" },
    { etiqueta: "C", titulo: "Cursiva", activo: editor.isActive("italic"), fn: () => editor.chain().focus().toggleItalic().run(), clase: "italic" },
    { etiqueta: "T", titulo: "Título", activo: editor.isActive("heading", { level: 2 }), fn: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), clase: "font-semibold" },
    { etiqueta: "t", titulo: "Subtítulo", activo: editor.isActive("heading", { level: 3 }), fn: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), clase: "font-semibold" },
    { etiqueta: "•", titulo: "Lista", activo: editor.isActive("bulletList"), fn: () => editor.chain().focus().toggleBulletList().run(), clase: "" },
    { etiqueta: "1.", titulo: "Lista numerada", activo: editor.isActive("orderedList"), fn: () => editor.chain().focus().toggleOrderedList().run(), clase: "" },
    { etiqueta: "❝", titulo: "Cita", activo: editor.isActive("blockquote"), fn: () => editor.chain().focus().toggleBlockquote().run(), clase: "" },
  ];

  return (
    <div className="flex flex-wrap gap-1 border-b border-linea-fuerte bg-superficie-2 px-2 py-1.5">
      {acciones.map((a) => (
        <button
          key={a.titulo}
          type="button"
          title={a.titulo}
          aria-label={a.titulo}
          aria-pressed={a.activo}
          onClick={a.fn}
          className={`${boton(a.activo)} ${a.clase}`}
        >
          {a.etiqueta}
        </button>
      ))}
      <span className="mx-1 w-px bg-linea-fuerte" />
      <button
        type="button"
        title="Deshacer"
        aria-label="Deshacer"
        onClick={() => editor.chain().focus().undo().run()}
        className={boton(false)}
      >
        ↶
      </button>
      <button
        type="button"
        title="Rehacer"
        aria-label="Rehacer"
        onClick={() => editor.chain().focus().redo().run()}
        className={boton(false)}
      >
        ↷
      </button>
    </div>
  );
}
