import { API_URL, getHeaders } from './config.js';
import { currentProducts, setProducts } from './state.js';
import { renderActionButtons } from './ui-components.js';

export function renderProductsList() {
    const list = document.getElementById('products-list');
    if (!list) return;

    list.innerHTML = '';

    if (!currentProducts || currentProducts.length === 0) {
        list.innerHTML = '<p style="font-style:italic; color:#666;">Aucun produit ajouté.</p>';
        return;
    }

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th style="width: 60px;">Photo</th>
                <th>Nom</th>
                <th>Prix</th>
                <th>Description</th>
                <th style="width: 380px;">Actions</th>
            </tr>
        </thead>
        <tbody id="products-tbody"></tbody>
    `;

    const tbody = table.querySelector('tbody');

    currentProducts.forEach((prod, index) => {
        const tr = document.createElement('tr');

        const isFirst = index === 0;
        const isLast = index === currentProducts.length - 1;

        const imgDisplay = prod.image ? `<img src="/images/${prod.image}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">` : '';

        tr.innerHTML = `
            <td style="text-align:center; vertical-align:middle;">
                <div style="display:flex; justify-content:center; align-items:center; height:100%;">${imgDisplay}</div>
            </td>
            <td><strong>${prod.name}</strong></td>
            <td>${prod.price} €</td>
            <td style="font-size:0.9em; color:#666;">${prod.description || ''}</td>
            <td>
                ${renderActionButtons(`editProduct(${index})`, `removeProduct(${index})`, {
            editLabel: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>`,
            extraHtml: `
                     <div style="display:flex; flex-direction:column; gap:2px; align-items:center;">
                         <img src="/images/arrow-up.svg" 
                              onclick="moveProductUp(${index})" 
                              style="width:24px; height:24px; cursor:pointer; ${isFirst ? 'opacity:0.3; cursor:default;' : ''}"
                              title="Monter">
                         <img src="/images/arrow-down.svg" 
                              onclick="moveProductDown(${index})" 
                              style="width:24px; height:24px; cursor:pointer; ${isLast ? 'opacity:0.3; cursor:default;' : ''}"
                              title="Descendre">
                     </div>
                    ${prod.image ? `<span class="vertical-sep"></span><button onclick="openProductPositioning(${index})" title="Positionner la photo"
                        style="width: 36px; height: 36px; padding: 0; background-color: var(--primary); color: var(--dark); display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 4px; cursor: pointer;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="22" y1="12" x2="18" y2="12"></line>
                            <line x1="6" y1="12" x2="2" y2="12"></line>
                            <line x1="12" y1="6" x2="12" y2="2"></line>
                            <line x1="12" y1="22" x2="12" y2="18"></line>
                        </svg></button>` : ''}
                `
        })}
            </td>
        `;
        tbody.appendChild(tr);
    });

    list.appendChild(table);
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

    const container = document.getElementById('products-list');
    const items = container.querySelectorAll('tbody tr');
    const currentItem = items[index];
    const prevItem = items[index - 1];

    if (!currentItem || !prevItem) return;

    // Add animation classes
    currentItem.classList.add('anim-row', 'z-over');
    prevItem.classList.add('anim-row', 'z-under');

    // Trigger reflow
    void currentItem.offsetWidth;

    // Apply transform
    currentItem.classList.add('slide-up');
    prevItem.classList.add('slide-down');

    // Wait for animation
    setTimeout(() => {
        const temp = currentProducts[index];
        currentProducts[index] = currentProducts[index - 1];
        currentProducts[index - 1] = temp;

        // Optimistic Render: Update UI immediately
        renderProductsList();

        // Save in background
        saveProducts(currentProducts);
    }, 400);
}

export function moveProductDown(index) {
    if (index >= currentProducts.length - 1) return;

    const container = document.getElementById('products-list');
    const items = container.querySelectorAll('tbody tr');
    const currentItem = items[index];
    const nextItem = items[index + 1];

    if (!currentItem || !nextItem) return;

    // Add animation classes
    currentItem.classList.add('anim-row', 'z-over');
    nextItem.classList.add('anim-row', 'z-under');

    // Trigger reflow
    void currentItem.offsetWidth;

    // Apply transform
    currentItem.classList.add('slide-down');
    nextItem.classList.add('slide-up');

    // Wait for animation
    setTimeout(() => {
        const temp = currentProducts[index];
        currentProducts[index] = currentProducts[index + 1];
        currentProducts[index + 1] = temp;

        // Optimistic Render
        renderProductsList();

        // Save in background
        saveProducts(currentProducts);
    }, 400);
}

window.addProduct = addProduct;
window.removeProduct = removeProduct;
window.editProduct = editProduct;
window.openProductPositioning = openProductPositioning;
window.cancelEdit = cancelEdit;
window.moveProductUp = moveProductUp;
window.moveProductDown = moveProductDown;
