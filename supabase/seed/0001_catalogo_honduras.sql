-- Catálogo geográfico: Honduras completa (18 departamentos + municipios) y un listado
-- de países comunes para corredores extranjeros ("otros países"). Idempotente: se puede
-- volver a correr sin duplicar filas.

insert into public.paises (nombre, codigo_iso) values
  ('Honduras', 'HN'),
  ('Guatemala', 'GT'),
  ('El Salvador', 'SV'),
  ('Nicaragua', 'NI'),
  ('Costa Rica', 'CR'),
  ('Panamá', 'PA'),
  ('México', 'MX'),
  ('Estados Unidos', 'US'),
  ('España', 'ES'),
  ('Colombia', 'CO'),
  ('Argentina', 'AR'),
  ('Chile', 'CL'),
  ('Perú', 'PE'),
  ('Ecuador', 'EC'),
  ('República Dominicana', 'DO'),
  ('Venezuela', 'VE'),
  ('Canadá', 'CA')
on conflict (codigo_iso) do nothing;

insert into public.departamentos (pais_id, nombre)
select (select id from public.paises where codigo_iso = 'HN'), d.nombre
from (values
  ('Atlántida'), ('Choluteca'), ('Colón'), ('Comayagua'), ('Copán'), ('Cortés'),
  ('El Paraíso'), ('Francisco Morazán'), ('Gracias a Dios'), ('Intibucá'),
  ('Islas de la Bahía'), ('La Paz'), ('Lempira'), ('Ocotepeque'), ('Olancho'),
  ('Santa Bárbara'), ('Valle'), ('Yoro')
) as d(nombre)
on conflict (pais_id, nombre) do nothing;

insert into public.ciudades (departamento_id, nombre)
select dep.id, v.municipio
from (values
  -- Atlántida
  ('Atlántida','La Ceiba'), ('Atlántida','El Porvenir'), ('Atlántida','Esparta'),
  ('Atlántida','Jutiapa'), ('Atlántida','La Masica'), ('Atlántida','San Francisco'),
  ('Atlántida','Tela'), ('Atlántida','Arizona'),
  -- Choluteca
  ('Choluteca','Choluteca'), ('Choluteca','Apacilagua'), ('Choluteca','Concepción de María'),
  ('Choluteca','Duyure'), ('Choluteca','El Corpus'), ('Choluteca','El Triunfo'),
  ('Choluteca','Marcovia'), ('Choluteca','Morolica'), ('Choluteca','Namasigüe'),
  ('Choluteca','Orocuina'), ('Choluteca','Pespire'), ('Choluteca','San Antonio de Flores'),
  ('Choluteca','San Isidro'), ('Choluteca','San José'), ('Choluteca','San Marcos de Colón'),
  ('Choluteca','Santa Ana de Yusguare'),
  -- Colón
  ('Colón','Trujillo'), ('Colón','Balfate'), ('Colón','Iriona'), ('Colón','Limón'),
  ('Colón','Sabá'), ('Colón','Santa Fe'), ('Colón','Santa Rosa de Aguán'),
  ('Colón','Sonaguera'), ('Colón','Tocoa'), ('Colón','Bonito Oriental'),
  -- Comayagua
  ('Comayagua','Comayagua'), ('Comayagua','Ajuterique'), ('Comayagua','El Rosario'),
  ('Comayagua','Esquías'), ('Comayagua','Humuya'), ('Comayagua','La Libertad'),
  ('Comayagua','Lamaní'), ('Comayagua','La Trinidad'), ('Comayagua','Lejamaní'),
  ('Comayagua','Meámbar'), ('Comayagua','Minas de Oro'), ('Comayagua','Ojos de Agua'),
  ('Comayagua','San Jerónimo'), ('Comayagua','San José de Comayagua'),
  ('Comayagua','San José del Potrero'), ('Comayagua','San Luis'), ('Comayagua','San Sebastián'),
  ('Comayagua','Siguatepeque'), ('Comayagua','Villa de San Antonio'), ('Comayagua','Las Lajas'),
  ('Comayagua','Taulabé'),
  -- Copán
  ('Copán','Santa Rosa de Copán'), ('Copán','Cabañas'), ('Copán','Concepción'),
  ('Copán','Copán Ruinas'), ('Copán','Corquín'), ('Copán','Cucuyagua'), ('Copán','Dolores'),
  ('Copán','Dulce Nombre'), ('Copán','El Paraíso'), ('Copán','Florida'), ('Copán','La Jigua'),
  ('Copán','La Unión'), ('Copán','Nueva Arcadia'), ('Copán','San Agustín'),
  ('Copán','San Antonio'), ('Copán','San Jerónimo'), ('Copán','San José'),
  ('Copán','San Juan de Opoa'), ('Copán','San Nicolás'), ('Copán','San Pedro de Copán'),
  ('Copán','Santa Rita'), ('Copán','Trinidad de Copán'), ('Copán','Veracruz'),
  -- Cortés
  ('Cortés','San Pedro Sula'), ('Cortés','Choloma'), ('Cortés','Omoa'),
  ('Cortés','Pimienta'), ('Cortés','Potrerillos'), ('Cortés','Puerto Cortés'),
  ('Cortés','San Antonio de Cortés'), ('Cortés','San Francisco de Yojoa'),
  ('Cortés','San Manuel'), ('Cortés','Santa Cruz de Yojoa'), ('Cortés','Villanueva'),
  ('Cortés','La Lima'),
  -- El Paraíso
  ('El Paraíso','Yuscarán'), ('El Paraíso','Alauca'), ('El Paraíso','Danlí'),
  ('El Paraíso','El Paraíso'), ('El Paraíso','Güinope'), ('El Paraíso','Jacaleapa'),
  ('El Paraíso','Liure'), ('El Paraíso','Morocelí'), ('El Paraíso','Oropolí'),
  ('El Paraíso','Potrerillos'), ('El Paraíso','San Antonio de Flores'), ('El Paraíso','San Lucas'),
  ('El Paraíso','San Matías'), ('El Paraíso','Soledad'), ('El Paraíso','Teupasenti'),
  ('El Paraíso','Texiguat'), ('El Paraíso','Vado Ancho'), ('El Paraíso','Yauyupe'),
  ('El Paraíso','Trojes'),
  -- Francisco Morazán
  ('Francisco Morazán','Distrito Central'), ('Francisco Morazán','Alubarén'),
  ('Francisco Morazán','Cedros'), ('Francisco Morazán','Curarén'),
  ('Francisco Morazán','El Porvenir'), ('Francisco Morazán','Guaimaca'),
  ('Francisco Morazán','La Libertad'), ('Francisco Morazán','La Venta'),
  ('Francisco Morazán','Lepaterique'), ('Francisco Morazán','Maraita'),
  ('Francisco Morazán','Marale'), ('Francisco Morazán','Nueva Armenia'),
  ('Francisco Morazán','Ojojona'), ('Francisco Morazán','Orica'),
  ('Francisco Morazán','Reitoca'), ('Francisco Morazán','Sabanagrande'),
  ('Francisco Morazán','San Antonio de Oriente'), ('Francisco Morazán','San Buenaventura'),
  ('Francisco Morazán','San Ignacio'), ('Francisco Morazán','San Juan de Flores'),
  ('Francisco Morazán','San Miguelito'), ('Francisco Morazán','Santa Ana'),
  ('Francisco Morazán','Santa Lucía'), ('Francisco Morazán','Talanga'),
  ('Francisco Morazán','Tatumbla'), ('Francisco Morazán','Valle de Ángeles'),
  ('Francisco Morazán','Vallecillo'), ('Francisco Morazán','Villa de San Francisco'),
  -- Gracias a Dios
  ('Gracias a Dios','Puerto Lempira'), ('Gracias a Dios','Brus Laguna'),
  ('Gracias a Dios','Ahuas'), ('Gracias a Dios','Juan Francisco Bulnes'),
  ('Gracias a Dios','Ramón Villeda Morales'), ('Gracias a Dios','Wampusirpi'),
  -- Intibucá
  ('Intibucá','La Esperanza'), ('Intibucá','Camasca'), ('Intibucá','Colomoncagua'),
  ('Intibucá','Concepción'), ('Intibucá','Dolores'), ('Intibucá','Intibucá'),
  ('Intibucá','Jesús de Otoro'), ('Intibucá','Magdalena'), ('Intibucá','Masaguara'),
  ('Intibucá','San Antonio'), ('Intibucá','San Isidro'), ('Intibucá','San Juan'),
  ('Intibucá','San Marcos de la Sierra'), ('Intibucá','San Miguel Guancapla'),
  ('Intibucá','Santa Lucía'), ('Intibucá','Yamaranguila'), ('Intibucá','San Francisco de Opalaca'),
  -- Islas de la Bahía
  ('Islas de la Bahía','Roatán'), ('Islas de la Bahía','Guanaja'),
  ('Islas de la Bahía','José Santos Guardiola'), ('Islas de la Bahía','Utila'),
  -- La Paz
  ('La Paz','La Paz'), ('La Paz','Aguanqueterique'), ('La Paz','Cabañas'), ('La Paz','Cane'),
  ('La Paz','Chinacla'), ('La Paz','Guajiquiro'), ('La Paz','Lauterique'),
  ('La Paz','Marcala'), ('La Paz','Mercedes de Oriente'), ('La Paz','Opatoro'),
  ('La Paz','San Antonio del Norte'), ('La Paz','San José'), ('La Paz','San Juan'),
  ('La Paz','San Pedro de Tutule'), ('La Paz','Santa Ana'), ('La Paz','Santa Elena'),
  ('La Paz','Santa María'), ('La Paz','Santiago de Puringla'), ('La Paz','Yarula'),
  -- Lempira
  ('Lempira','Gracias'), ('Lempira','Belén'), ('Lempira','Candelaria'), ('Lempira','Cololaca'),
  ('Lempira','Erandique'), ('Lempira','Gualcince'), ('Lempira','Guarita'),
  ('Lempira','La Campa'), ('Lempira','La Iguala'), ('Lempira','Las Flores'),
  ('Lempira','La Unión'), ('Lempira','La Virtud'), ('Lempira','Lepaera'),
  ('Lempira','Mapulaca'), ('Lempira','Piraera'), ('Lempira','San Andrés'),
  ('Lempira','San Francisco'), ('Lempira','San Juan Guarita'), ('Lempira','San Manuel Colohete'),
  ('Lempira','San Rafael'), ('Lempira','San Sebastián'), ('Lempira','Santa Cruz'),
  ('Lempira','Talgua'), ('Lempira','Tambla'), ('Lempira','Tomalá'), ('Lempira','Valladolid'),
  ('Lempira','Virginia'), ('Lempira','San Marcos de Caiquín'),
  -- Ocotepeque
  ('Ocotepeque','Ocotepeque'), ('Ocotepeque','Belén Gualcho'), ('Ocotepeque','Concepción'),
  ('Ocotepeque','Dolores Merendón'), ('Ocotepeque','Fraternidad'), ('Ocotepeque','La Encarnación'),
  ('Ocotepeque','La Labor'), ('Ocotepeque','Lucerna'), ('Ocotepeque','Mercedes'),
  ('Ocotepeque','San Fernando'), ('Ocotepeque','San Francisco del Valle'), ('Ocotepeque','San Jorge'),
  ('Ocotepeque','San Marcos'), ('Ocotepeque','Santa Fe'), ('Ocotepeque','Sensenti'),
  ('Ocotepeque','Sinuapa'),
  -- Olancho
  ('Olancho','Juticalpa'), ('Olancho','Campamento'), ('Olancho','Catacamas'),
  ('Olancho','Concordia'), ('Olancho','Dulce Nombre de Culmí'), ('Olancho','El Rosario'),
  ('Olancho','Esquipulas del Norte'), ('Olancho','Gualaco'), ('Olancho','Guarizama'),
  ('Olancho','Guata'), ('Olancho','Guayape'), ('Olancho','Jano'), ('Olancho','La Unión'),
  ('Olancho','Mangulile'), ('Olancho','Manto'), ('Olancho','Salamá'), ('Olancho','San Esteban'),
  ('Olancho','Santa María del Real'), ('Olancho','Silca'), ('Olancho','Yocón'),
  ('Olancho','Patuca'), ('Olancho','San Francisco de Becerra'), ('Olancho','San Francisco de la Paz'),
  -- Santa Bárbara
  ('Santa Bárbara','Santa Bárbara'), ('Santa Bárbara','Arada'), ('Santa Bárbara','Atima'),
  ('Santa Bárbara','Azacualpa'), ('Santa Bárbara','Ceguaca'), ('Santa Bárbara','Concepción del Norte'),
  ('Santa Bárbara','Concepción del Sur'), ('Santa Bárbara','Chinda'), ('Santa Bárbara','El Níspero'),
  ('Santa Bárbara','Gualala'), ('Santa Bárbara','Ilama'), ('Santa Bárbara','Trinidad'),
  ('Santa Bárbara','Las Vegas'), ('Santa Bárbara','Macuelizo'), ('Santa Bárbara','Naranjito'),
  ('Santa Bárbara','Nuevo Celilac'), ('Santa Bárbara','Petoa'), ('Santa Bárbara','Protección'),
  ('Santa Bárbara','Quimistán'), ('Santa Bárbara','San Francisco de Ojuera'),
  ('Santa Bárbara','San José de Colinas'), ('Santa Bárbara','San Luis'),
  ('Santa Bárbara','San Marcos'), ('Santa Bárbara','San Nicolás'),
  ('Santa Bárbara','San Pedro Zacapa'), ('Santa Bárbara','San Vicente Centenario'),
  ('Santa Bárbara','Santa Rita'), ('Santa Bárbara','Nueva Frontera'),
  -- Valle
  ('Valle','Nacaome'), ('Valle','Alianza'), ('Valle','Amapala'), ('Valle','Aramecina'),
  ('Valle','Caridad'), ('Valle','Goascorán'), ('Valle','Langue'),
  ('Valle','San Francisco de Coray'), ('Valle','San Lorenzo'),
  -- Yoro
  ('Yoro','Yoro'), ('Yoro','Arenal'), ('Yoro','El Negrito'), ('Yoro','El Progreso'),
  ('Yoro','Jocón'), ('Yoro','Morazán'), ('Yoro','Olanchito'), ('Yoro','Santa Rita'),
  ('Yoro','Sulaco'), ('Yoro','Victoria'), ('Yoro','Yorito')
) as v(departamento, municipio)
join public.departamentos dep on dep.nombre = v.departamento
  and dep.pais_id = (select id from public.paises where codigo_iso = 'HN')
on conflict (departamento_id, nombre) do nothing;
