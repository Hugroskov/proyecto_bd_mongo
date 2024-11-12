
let isEditing = false;
let editingProductId = null;
let isAdminLoggedIn = false; 


function showAdminLogin() {
    document.getElementById("adminLoginSection").classList.remove("hidden");
    document.getElementById("adminSection").classList.add("hidden");
    document.getElementById("clientSection").classList.add("hidden");
}


function showAdmin() {
    if (isAdminLoggedIn) {
        document.getElementById("adminSection").classList.remove("hidden");
        document.getElementById("adminLoginSection").classList.add("hidden");
        document.getElementById("clientSection").classList.add("hidden");
        fetchProducts();
    } else {
        showAdminLogin();
    }
}


function showClient() {
    document.getElementById("adminSection").classList.add("hidden");
    document.getElementById("clientSection").classList.remove("hidden");
    document.getElementById("adminLoginSection").classList.add("hidden");
    fetchAvailableProducts();
}


function backToMain() {
    document.getElementById("adminLoginSection").classList.add("hidden");
    document.getElementById("adminSection").classList.add("hidden");
    document.getElementById("clientSection").classList.add("hidden");
}


function logoutAdmin() {
    isAdminLoggedIn = false;
    backToMain();
}


async function fetchAvailableProducts() {
    try {
        const response = await fetch("/cliente/productos/");
        if (!response.ok) {
            throw new Error("Error al obtener los productos");
        }
        const products = await response.json();
        const productTableBody = document.querySelector("#clientProductTable tbody");
        if (!productTableBody) {
            console.error("No se encontró el elemento tbody en clientProductTable");
            return;
        }
        productTableBody.innerHTML = "";
        products.forEach(product => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${product.nombre}</td>
                <td>${product.descripcion}</td>
                <td>$${product.precio.toFixed(2)}</td>
                <td>${product.cantidad_en_stock}</td>
                <td>
                    <button onclick="buyProduct('${product.id}')">Comprar</button>
                </td>
            `;
            productTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error al obtener los productos:", error);
    }
}


async function buyProduct(productId) {
    const quantity = prompt("¿Cuántas unidades deseas comprar?", "1");
    if (quantity !== null && parseInt(quantity) > 0) {
        const purchaseData = {
            producto_id: productId,
            cantidad: parseInt(quantity),
        };
        try {
            const response = await fetch("/cliente/comprar/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(purchaseData)
            });
            if (response.ok) {
                alert("Compra realizada exitosamente!");
                fetchAvailableProducts();
            } else {
                const errorData = await response.json();
                alert("Error al realizar la compra: " + errorData.detail);
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }
}


async function fetchProducts() {
    try {
        const response = await fetch("/admin/productos/");
        const products = await response.json();
        const productTableBody = document.querySelector("#productTable tbody");
        productTableBody.innerHTML = "";
        products.forEach(product => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${product.nombre}</td>
                <td>${product.descripcion}</td>
                <td>$${product.precio}</td>
                <td>${product.cantidad_en_stock}</td>
                <td>
                    <button onclick="editProduct('${product.id}')">Editar</button>
                    <button onclick="deleteProduct('${product.id}')">Eliminar</button>
                </td>
            `;
            productTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error al obtener los productos:", error);
    }
}


async function editProduct(productId) {
    try {
        const response = await fetch(`/admin/productos/${productId}`);
        const product = await response.json();
        if (product) {
            isEditing = true;
            editingProductId = productId;
            document.getElementById("productFormTitle").innerText = "Editar Producto";
            document.getElementById("productName").value = product.nombre;
            document.getElementById("productDesc").value = product.descripcion;
            document.getElementById("productPrice").value = product.precio;
            document.getElementById("productStock").value = product.cantidad_en_stock;
        }
    } catch (error) {
        console.error("Error al obtener el producto:", error);
    }
}

// Función para eliminar producto
async function deleteProduct(productId) {
    if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
        try {
            const response = await fetch(`/admin/productos/${productId}`, {
                method: "DELETE",
            });
            if (response.ok) {
                alert("Producto eliminado exitosamente!");
                fetchProducts();
            } else {
                alert("Error al eliminar el producto");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }
}


document.addEventListener("DOMContentLoaded", function() {

    document.getElementById("productForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        const name = document.getElementById("productName").value;
        const desc = document.getElementById("productDesc").value;
        const price = document.getElementById("productPrice").value;
        const stock = document.getElementById("productStock").value;
        const productData = {
            nombre: name,
            descripcion: desc,
            precio: parseFloat(price),
            cantidad_en_stock: parseInt(stock),
        };
        try {
            let response;
            if (isEditing) {

                response = await fetch(`/admin/productos/${editingProductId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(productData)
                });
            } else {

                response = await fetch("/admin/productos/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(productData)
                });
            }
            if (response.ok) {
                alert("Producto guardado exitosamente!");
                document.getElementById("productForm").reset();
                isEditing = false;
                editingProductId = null;
                document.getElementById("productFormTitle").innerText = "Agregar Producto";
                fetchProducts();
            } else {
                alert("Error al guardar el producto");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    });


    document.getElementById("adminLoginForm").addEventListener("submit", function(event) {
        event.preventDefault();
        const username = document.getElementById("adminUsername").value;
        const password = document.getElementById("adminPassword").value;

        if (username === "admin" && password === "admin123") {
            isAdminLoggedIn = true;
            document.getElementById("adminLoginSection").classList.add("hidden");
            showAdmin(); 
        } else {
            alert("Usuario o contraseña incorrectos");
        }
    });


    backToMain();
});
