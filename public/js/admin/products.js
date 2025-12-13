import { API_URL, getHeaders } from './config.js';
import { currentProducts, setProducts } from './state.js';

export function renderProductsList() {
    const list = document.getElementById('products-list');
    if (!list) return;

    list.innerHTML = '';

    if (!currentProducts || currentProducts.length === 0) {
        list.innerHTML = '<p style="font-style:italic; color:#666;">Aucun produit ajouté.</p>';
        return;
    }

    currentProducts.forEach((prod, index) => {
        const item = document.createElement('div');
        item.className = 'service-item'; // Reuse service-item styling if possible or generic
        item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#eee; padding:10px; margin-bottom:5px; border-radius:4px;';

        const imgDisplay = prod.image ? `<img src="/images/${prod.image}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; margin-right:10px;">` : '';

        item.innerHTML = `
            <div style="display:flex; align-items:center;">
                ${imgDisplay}
                <div>
                    <strong>${prod.name}</strong> - ${prod.price}€
                    <br><small style="color:#666;">${prod.description || ''}</small>
                </div>
            </div>
            <button onclick="removeProduct(${index})" style="background:none; border:none; color:red; cursor:pointer;" title="Supprimer">&times;</button>
        `;
        list.appendChild(item);
    });
}

export async function addProduct() {
    const name = document.getElementById('new-product-name').value;
    const price = document.getElementById('new-product-price').value;
    const desc = document.getElementById('new-product-desc').value;
    const fileInput = document.getElementById('new-product-file');

    if (!name || !price) return alert('Nom et Prix requis');

    let imageName = null;

    if (fileInput.files.length > 0) {
        // Upload Image
        const formData = new FormData();
        // Use timestamp to ensure unique filename if user re-uploads same name? 
        // Or just let server handle it? Server uses fieldname as filename in current logic?
        // Wait, `settings.js` `uploadImages` uses fieldname.
        // I should probably change the server logic to allow dynamic filenames or use a specific format.
        // Current server logic: `filename = file.fieldname`. This is limiting for arrays of products.
        // Ideally I want to upload with a constructed filename like `product-${Date.now()}`.
        // But `uploadImages` controller takes fieldnames.
        // Workaround: I append the file with a specific unique fieldname.

        const uniqueId = `prod_${Date.now()}`;
        formData.append(uniqueId, fileInput.files[0]);

        try {
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': 'Basic ' + localStorage.getItem('auth') }, // Manual auth header for multipart
                body: formData
            });

            if (!res.ok) throw new Error('Erreur upload');
            imageName = uniqueId; // The server saves it as the fieldname
        } catch (e) {
            console.error(e);
            return alert("Erreur lors de l'upload de l'image");
        }
    }

    const newProd = {
        id: Date.now(),
        name,
        price,
        description: desc,
        image: imageName
    };

    const newProducts = [...currentProducts, newProd];

    try {
        await saveProducts(newProducts);
        // Clear inputs
        document.getElementById('new-product-name').value = '';
        document.getElementById('new-product-price').value = '';
        document.getElementById('new-product-desc').value = '';
        document.getElementById('new-product-file').value = '';
    } catch (e) {
        alert('Erreur lors de la sauvegarde du produit');
    }
}

export async function removeProduct(index) {
    if (!confirm('Supprimer ce produit ?')) return;
    const newProducts = [...currentProducts];
    newProducts.splice(index, 1);
    await saveProducts(newProducts);
}

async function saveProducts(products) {
    // We send only products array update
    await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ products })
    });

    // Update local state (polling will confirm later but good for UI responsiveness)
    setProducts(products);
    renderProductsList();
}

// Global exposure
window.addProduct = addProduct;
window.removeProduct = removeProduct;
