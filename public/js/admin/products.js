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
        item.className = 'service-item';
        item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#eee; padding:10px; margin-bottom:5px; border-radius:4px;';

        const isFirst = index === 0;
        const isLast = index === currentProducts.length - 1;

        const imgDisplay = prod.image ? `<img src="/images/${prod.image}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; margin-right:10px;">` : '';

        item.innerHTML = `
            <div style="display:flex; align-items:center;">
                ${imgDisplay}
                <div>
                    <strong>${prod.name}</strong> - ${prod.price}€
                    <br><small style="color:#666;">${prod.description || ''}</small>
                </div>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
                 <div style="display:flex; gap:2px; margin-right:5px;">
                     <button class="btn-action btn-up" onclick="moveProductUp(${index})" ${isFirst ? 'disabled style="opacity:0.3; cursor:default;"' : ''} title="Monter">⬆️</button>
                     <button class="btn-action btn-down" onclick="moveProductDown(${index})" ${isLast ? 'disabled style="opacity:0.3; cursor:default;"' : ''} title="Descendre">⬇️</button>
                 </div>
                ${prod.image ? `<button onclick="openProductPositioning(${index})" class="btn-action" style="background:#f0ad4e;" title="Positionner la photo">Positionner</button>` : ''}
                <button onclick="editProduct(${index})" class="btn-action btn-edit" title="Modifier">Modifier</button>
                <button onclick="removeProduct(${index})" style="background:none; border:none; color:red; cursor:pointer; font-size: 24px; padding: 0 10px;" title="Supprimer">&times;</button>
            </div>
        `;
        list.appendChild(item);
    });
}

export function openProductPositioning(index) {
    const product = currentProducts[index];
    if (!product || !product.image) return alert('Produit ou image manquant');

    const imageUrl = `/images/${product.image}`;
    const initialX = product.imagePosition ? product.imagePosition.x : 50;
    const initialY = product.imagePosition ? product.imagePosition.y : 50;

    openGenericPositioning(imageUrl, initialX, initialY, async (x, y) => {
        const newProducts = [...currentProducts];
        newProducts[index] = { ...newProducts[index], imagePosition: { x, y } };

        try {
            await saveProducts(newProducts);
            alert('Position sauvegardée');
            closePositionModal();
        } catch (e) {
            alert('Erreur sauvegarde');
        }
    });
}

// EDITING VARIABLES
let editingIndex = -1;

function getFormContainer() {
    // Robustly find the container: it's the sibling after the list
    return document.getElementById('products-list').nextElementSibling;
}

export function editProduct(index) {
    const product = currentProducts[index];
    if (!product) return;

    editingIndex = index;

    document.getElementById('new-product-name').value = product.name;
    document.getElementById('new-product-price').value = product.price;
    document.getElementById('new-product-desc').value = product.description || '';

    const container = getFormContainer();
    if (container) {
        // Update Header
        const header = container.querySelector('h5');
        if (header) header.textContent = 'Modifier le produit';

        // Add Highlight
        container.classList.add('editing-mode');
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Update Add Button
        const addBtn = document.getElementById('btn-add-product');
        if (addBtn) addBtn.textContent = 'Mettre à jour';

        // Show Cancel Button
        const cancelBtn = document.getElementById('btn-cancel-product');
        if (cancelBtn) {
            cancelBtn.style.display = 'inline-block';
            cancelBtn.style.background = '#ccc';
            cancelBtn.style.color = '#000';
            cancelBtn.style.marginLeft = '10px';
        }
    }
}

export function cancelEdit() {
    editingIndex = -1;
    document.getElementById('new-product-name').value = '';
    document.getElementById('new-product-price').value = '';
    document.getElementById('new-product-desc').value = '';
    document.getElementById('new-product-file').value = '';

    const container = getFormContainer();
    if (container) {
        const header = container.querySelector('h5');
        if (header) header.textContent = 'Ajouter un produit';

        container.classList.remove('editing-mode');

        const addBtn = document.getElementById('btn-add-product');
        if (addBtn) addBtn.textContent = 'Ajouter';

        const cancelBtn = document.getElementById('btn-cancel-product');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }
}

export async function addProduct() {
    const name = document.getElementById('new-product-name').value;
    const price = document.getElementById('new-product-price').value;
    const desc = document.getElementById('new-product-desc').value;
    const fileInput = document.getElementById('new-product-file');

    if (!name || !price) return alert('Nom et Prix requis');

    let imageName = null;

    if (fileInput.files.length > 0) {
        const formData = new FormData();
        const uniqueId = `prod_${Date.now()}`;
        formData.append(uniqueId, fileInput.files[0]);

        try {
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': 'Basic ' + localStorage.getItem('auth') },
                body: formData
            });

            if (!res.ok) throw new Error('Erreur upload');
            imageName = uniqueId;
        } catch (e) {
            console.error(e);
            return alert("Erreur lors de l'upload de l'image");
        }
    }

    const newProducts = [...currentProducts];

    if (editingIndex >= 0) {
        // UPDATE
        const existing = newProducts[editingIndex];
        newProducts[editingIndex] = {
            ...existing,
            name,
            price,
            description: desc,
            image: imageName || existing.image
        };
    } else {
        // CREATE
        const newProd = {
            id: Date.now(),
            name,
            price,
            description: desc,
            image: imageName
        };
        newProducts.push(newProd);
    }

    try {
        await saveProducts(newProducts);
        cancelEdit(); // Reset form
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
    await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ products })
    });

    setProducts(products);
    renderProductsList();
}

// Reordering
export function moveProductUp(index) {
    if (index <= 0) return;
    const temp = currentProducts[index];
    currentProducts[index] = currentProducts[index - 1];
    currentProducts[index - 1] = temp;
    renderProductsList();
    saveProducts(currentProducts);
}

export function moveProductDown(index) {
    if (index >= currentProducts.length - 1) return;
    const temp = currentProducts[index];
    currentProducts[index] = currentProducts[index + 1];
    currentProducts[index + 1] = temp;
    renderProductsList();
    saveProducts(currentProducts);
}

window.addProduct = addProduct;
window.removeProduct = removeProduct;
window.editProduct = editProduct;
window.openProductPositioning = openProductPositioning;
window.cancelEdit = cancelEdit;
window.moveProductUp = moveProductUp;
window.moveProductDown = moveProductDown;
