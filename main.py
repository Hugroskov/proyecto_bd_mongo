from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional
from bson import ObjectId
import os
from fastapi.middleware.cors import CORSMiddleware
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


try:
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.tienda_db
    logger.info("Conectado a la base de datos MongoDB")
except Exception as e:
    logger.error(f"Error al conectar a MongoDB: {e}")

app.mount("/static", StaticFiles(directory="frontend/static"), name="static")


class Producto(BaseModel):
    id: Optional[str]
    nombre: str
    descripcion: str
    precio: float = Field(..., gt=0)
    cantidad_en_stock: int = Field(..., ge=0)
    
    class Config:
        orm_mode = True

def producto_helper(producto) -> dict:
    return {
        "id": str(producto["_id"]),
        "nombre": producto["nombre"],
        "descripcion": producto["descripcion"],
        "precio": producto["precio"],
        "cantidad_en_stock": producto["cantidad_en_stock"],
    }


@app.get("/")
async def read_index():
    logger.info("Sirviendo index.html")
    return FileResponse(os.path.join("frontend", "index.html"))


@app.get("/admin/productos/", response_model=List[Producto])
async def obtener_productos():
    try:
        productos = await db.productos.find().to_list(100)
        return [producto_helper(producto) for producto in productos]
    except Exception as e:
        logger.error(f"Error al obtener productos: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@app.get("/admin/productos/{producto_id}", response_model=Producto)
async def obtener_producto(producto_id: str):
    try:
        producto = await db.productos.find_one({"_id": ObjectId(producto_id)})
        if producto:
            return producto_helper(producto)
        else:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
    except Exception as e:
        logger.error(f"Error al obtener el producto: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@app.post("/admin/productos/", response_model=Producto)
async def crear_producto(producto: Producto):
    try:
        producto_dict = producto.dict(exclude_unset=True)
        if "id" in producto_dict:
            del producto_dict["id"]  # Eliminar id si está presente
        result = await db.productos.insert_one(producto_dict)
        nuevo_producto = await db.productos.find_one({"_id": result.inserted_id})
        logger.info(f"Producto creado con ID: {result.inserted_id}")
        return producto_helper(nuevo_producto)
    except Exception as e:
        logger.error(f"Error al crear producto: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")
    
@app.put("/admin/productos/{producto_id}", response_model=Producto)
async def actualizar_producto(producto_id: str, producto: Producto):
    try:
        producto_dict = producto.dict(exclude={"id"}, exclude_unset=True)
        result = await db.productos.update_one(
            {"_id": ObjectId(producto_id)},
            {"$set": producto_dict}
        )
        if result.matched_count == 0:
            logger.warning(f"Producto con ID {producto_id} no encontrado para actualizar")
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        producto_actualizado = await db.productos.find_one({"_id": ObjectId(producto_id)})
        logger.info(f"Producto con ID {producto_id} actualizado")
        return producto_helper(producto_actualizado)
    except Exception as e:
        logger.error(f"Error al actualizar producto: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@app.delete("/admin/productos/{producto_id}")
async def eliminar_producto(producto_id: str):
    try:
        result = await db.productos.delete_one({"_id": ObjectId(producto_id)})
        if result.deleted_count:
            logger.info(f"Producto con ID {producto_id} eliminado")
            return {"detail": "Producto eliminado exitosamente"}
        else:
            logger.warning(f"Producto con ID {producto_id} no encontrado para eliminar")
            raise HTTPException(status_code=404, detail="Producto no encontrado")
    except Exception as e:
        logger.error(f"Error al eliminar producto: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")
    

class Compra(BaseModel):
    producto_id: str
    cantidad: int = Field(..., gt=0)

@app.post("/cliente/comprar/", response_model=Producto)
async def realizar_compra(compra: Compra):
    try:
        producto = await db.productos.find_one({"_id": ObjectId(compra.producto_id)})
        if not producto:
            logger.warning(f"Producto con ID {compra.producto_id} no encontrado para compra")
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        if producto["cantidad_en_stock"] < compra.cantidad:
            logger.warning(f"Stock insuficiente para el producto ID {compra.producto_id}")
            raise HTTPException(status_code=400, detail="Stock insuficiente")
   
        await db.productos.update_one(
            {"_id": ObjectId(compra.producto_id)},
            {"$inc": {"cantidad_en_stock": -compra.cantidad}}
        )
        producto_actualizado = await db.productos.find_one({"_id": ObjectId(compra.producto_id)})
        logger.info(f"Compra realizada para el producto ID {compra.producto_id}")
        return producto_helper(producto_actualizado)
    except Exception as e:
        logger.error(f"Error al realizar compra: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@app.get("/cliente/productos/", response_model=List[Producto])
async def obtener_productos_disponibles():
    try:
        productos = await db.productos.find({"cantidad_en_stock": {"$gt": 0}}).to_list(100)
        return [producto_helper(producto) for producto in productos]
    except Exception as e:
        logger.error(f"Error al obtener productos disponibles: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")
