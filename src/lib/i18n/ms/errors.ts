/** Bahasa Melayu phrases for this area of the app (see ./index.ts for the glossary). */
const dict: Record<string, string> = {
  // general
  "Something went wrong and nothing was saved. Please try again.": "Ada masalah dan tiada apa yang disimpan. Sila cuba lagi.",
  "Check the form.": "Sila semak borang.",
  "Check the draft.": "Sila semak draf.",

  // placing and pricing orders
  "Add at least one item.": "Tambah sekurang-kurangnya satu item.",
  "Too many items in one order.": "Terlalu banyak item dalam satu pesanan.",
  "An item in your cart is no longer on the menu.": "Ada item dalam troli anda yang sudah tiada dalam menu.",
  "{name} is sold out.": "{name} sudah habis.",
  "Quantity must be between 1 and 99.": "Kuantiti mesti antara 1 hingga 99.",
  "An add-on for {name} is no longer available.": "Satu tambahan untuk {name} sudah tiada.",
  "Choose {group} for {name}.": "Pilih {group} untuk {name}.",
  "Pick up to {max} for {group}.": "Pilih tidak lebih daripada {max} untuk {group}.",
  "Pick which member this order belongs to.": "Pilih ahli untuk pesanan ini.",
  "Pick which staff this order belongs to.": "Pilih staf untuk pesanan ini.",
  "Pick which corporate this order belongs to.": "Pilih pelanggan korporat untuk pesanan ini.",
  "{name} is registered as member, not staff.": "{name} didaftarkan sebagai ahli, bukan staf.",
  "{name} is registered as member, not corporate.": "{name} didaftarkan sebagai ahli, bukan korporat.",
  "{name} is registered as staff, not member.": "{name} didaftarkan sebagai staf, bukan ahli.",
  "{name} is registered as staff, not corporate.": "{name} didaftarkan sebagai staf, bukan korporat.",
  "{name} is registered as corporate, not member.": "{name} didaftarkan sebagai korporat, bukan ahli.",
  "{name} is registered as corporate, not staff.": "{name} didaftarkan sebagai korporat, bukan staf.",
  "Customer not found.": "Pelanggan tidak dijumpai.",
  "Corporate customer not found.": "Pelanggan korporat tidak dijumpai.",
  "This kedai is not taking orders right now.": "Kedai ini tidak menerima pesanan buat masa ini.",
  "This table QR is no longer active. Ask the counter.": "QR meja ini sudah tidak aktif. Sila tanya di kaunter.",
  "Order not found.": "Pesanan tidak dijumpai.",
  "This order is already settled.": "Pesanan ini sudah dijelaskan.",
  "This order was cancelled.": "Pesanan ini sudah dibatalkan.",

  // payments at the counter
  "Cash received is less than the bill.": "Tunai yang diterima kurang daripada bil.",
  "Enter the last digits of the bank reference to confirm the QR payment.":
    "Masukkan digit terakhir rujukan bank untuk sahkan bayaran QR.",
  "Credit is only for corporate customers. Set the customer type first.":
    "Kredit hanya untuk pelanggan korporat. Tetapkan jenis pelanggan dulu.",
  "{name} would exceed their credit limit.": "{name} akan melebihi had kredit.",
  "The bill changed while you were paying. Check the total and try again.":
    "Bil berubah semasa bayaran dibuat. Semak jumlah dan cuba lagi.",
  "Today is already closed in Recon. Ask the owner to reopen it before taking more payments.":
    "Hari ini sudah ditutup dalam Rekon. Minta pemilik buka semula sebelum terima bayaran lagi.",
  "Enter the cash received as a number, e.g. 20 or 20.50.": "Masukkan tunai yang diterima dalam nombor, cth. 20 atau 20.50.",
  "Give a reason for the void.": "Nyatakan sebab pembatalan bayaran.",
  "Nothing to void.": "Tiada bayaran untuk dibatalkan.",
  "{date} is already closed in Recon. Reopen that day first.": "{date} sudah ditutup dalam Rekon. Buka semula hari itu dulu.",
  "Pick how they paid.": "Pilih cara mereka bayar.",
  "They only owe {amount}.": "Mereka hanya berhutang {amount}.",
  "Payment recorded.": "Bayaran direkodkan.",

  // order status
  "Can't move a {from} order to {to}.": "Pesanan yang {from} tidak boleh ditukar ke {to}.",
  "Only the counter can cancel orders.": "Hanya kaunter boleh batalkan pesanan.",
  "This order is paid. Refund it at the counter first.": "Pesanan ini sudah dibayar. Pulangkan wang di kaunter dulu.",
  "Someone else just updated this order. Refresh and try again.":
    "Ada orang lain baru kemas kini pesanan ini. Muat semula dan cuba lagi.",
  "Pick a table for dine-in, or switch to takeaway.": "Pilih meja untuk makan sini, atau tukar ke bungkus.",

  // amounts and rates (labels are translated separately)
  "Enter a valid amount for {label}.": "Masukkan jumlah yang betul untuk {label}.",
  "{label} must be between 0 and 100%.": "{label} mesti antara 0 hingga 100%.",
  "credit limit": "had kredit",
  amount: "jumlah",
  "Member discount": "Diskaun ahli",
  "Staff discount": "Diskaun staf",
  "opening float": "duit permulaan laci",
  "cash counted": "tunai yang dikira",
  "QR in bank": "QR dalam bank",

  // menu
  "Enter a category name.": "Masukkan nama kategori.",
  "Category not found.": "Kategori tidak dijumpai.",
  "Give the item a name.": "Beri nama untuk item ini.",
  "Pick a category.": "Pilih kategori.",
  "Every add-on group needs a name.": "Setiap kumpulan tambahan perlukan nama.",
  "Every option needs a name.": "Setiap pilihan perlukan nama.",
  "Each add-on group needs at least one option.": "Setiap kumpulan tambahan perlukan sekurang-kurangnya satu pilihan.",
  "Enter a price, e.g. 8.50.": "Masukkan harga, cth. 8.50.",
  "Item not found.": "Item tidak dijumpai.",
  "Check the extra price for {name}.": "Semak harga tambahan untuk {name}.",
  "{name} saved": "{name} disimpan",
  "{name} added to the menu": "{name} ditambah ke menu",
  "{name} deleted": "{name} dipadam",

  // images
  "Use a JPG, PNG or WebP image.": "Guna gambar JPG, PNG atau WebP.",
  "That image is too big. Try a smaller photo.": "Gambar itu terlalu besar. Cuba gambar yang lebih kecil.",
  "That file isn't a readable image.": "Fail itu bukan gambar yang boleh dibaca.",

  // tables
  "Table name can't be empty.": "Nama meja tidak boleh kosong.",
  "Table not found.": "Meja tidak dijumpai.",

  // customers
  "Pick a customer type.": "Pilih jenis pelanggan.",
  "Enter a name.": "Masukkan nama.",
  "Customer added.": "Pelanggan ditambah.",

  // staff
  "Pick a role.": "Pilih peranan.",
  "Enter a valid email.": "Masukkan emel yang sah.",
  "That email is already used by another account.": "Emel itu sudah digunakan oleh akaun lain.",
  "You can't remove your own owner role.": "Anda tidak boleh buang peranan pemilik anda sendiri.",
  "Password needs at least 8 characters.": "Kata laluan perlu sekurang-kurangnya 8 aksara.",
  "Set a password of at least 8 characters.": "Tetapkan kata laluan sekurang-kurangnya 8 aksara.",
  "Staff not found.": "Staf tidak dijumpai.",
  "{name} can now log in.": "{name} kini boleh log masuk.",
  "You can't deactivate yourself.": "Anda tidak boleh nyahaktifkan diri sendiri.",

  // settings and brand
  "Settings saved.": "Tetapan disimpan.",
  "Enter the kedai name.": "Masukkan nama kedai.",
  "Saved. Customers see it straight away.": "Disimpan. Pelanggan terus nampak perubahan ini.",

  // recon
  "Pick a valid date.": "Pilih tarikh yang sah.",
  "You can't close a future date.": "Tarikh akan datang tidak boleh ditutup.",
  "{n} order(s) on {date} are still unpaid. Settle or cancel them first.":
    "{n} pesanan pada {date} masih belum bayar. Selesaikan atau batalkan dulu.",
  "{date} closed.": "{date} ditutup.",
  "This date is already closed.": "Tarikh ini sudah ditutup.",

  // customer QR ordering
  "Something in the cart looks wrong. Refresh and try again.": "Ada yang tak kena dalam troli. Muat semula dan cuba lagi.",
  "Kedai not found.": "Kedai tidak dijumpai.",
  "This table QR is not recognised. Ask the counter.": "QR meja ini tidak dikenali. Sila tanya di kaunter.",
  "Add your name so we can call you when it's ready.": "Masukkan nama anda supaya kami boleh panggil bila pesanan siap.",
  "Couldn't send the order. Try again or order at the counter.":
    "Pesanan tidak dapat dihantar. Cuba lagi atau pesan di kaunter.",

  // AI Menu
  "Today's AI limit is used up ({n} requests). Try again tomorrow.":
    "Had AI hari ini sudah habis ({n} permintaan). Cuba lagi esok.",
  "AI isn't set up yet. Ask Rubix to set OPENAI_API_KEY.": "AI belum disediakan. Minta Rubix tetapkan OPENAI_API_KEY.",
  "An attached image couldn't be found. Attach it again.": "Gambar yang dilampirkan tidak dijumpai. Lampirkan semula.",
  "The AI couldn't handle this request. Try different wording or another image.":
    "AI tak dapat memproses permintaan ini. Cuba ayat lain atau gambar lain.",
  "The AI is busy right now. Try again in a minute.": "AI sibuk sekarang. Cuba lagi dalam seminit.",
  "The OpenAI key is invalid. Ask Rubix to check OPENAI_API_KEY.": "Kunci OpenAI tidak sah. Minta Rubix semak OPENAI_API_KEY.",
  "Can't reach the AI right now. Try again shortly.": "AI tak dapat dihubungi sekarang. Cuba lagi sebentar.",
  "Every item needs a name.": "Setiap item perlukan nama.",
  "Every choice group needs a name.": "Setiap kumpulan pilihan perlukan nama.",
  "Choose an image first.": "Pilih gambar dulu.",
  "Write something or attach an image.": "Tulis sesuatu atau lampirkan gambar.",
  "The original image for one of the items is gone. Attach the poster again.":
    "Gambar asal untuk salah satu item sudah tiada. Lampirkan semula poster.",
  'Check the extra price for "{option}" on {name}.': 'Semak harga tambahan "{option}" untuk {name}.',
  "The draft is empty.": "Draf kosong.",
  "{name}: pick a category": "{name}: pilih kategori",
  "{name}: price isn't right yet": "{name}: harga belum betul",
  "Fix these first: {problems}.": "Betulkan dulu: {problems}.",
  "{name} is no longer on the menu.": "{name} sudah tiada dalam menu.",
  "{n} added": "{n} ditambah",
  "{n} updated": "{n} dikemas kini",
  "{n} removed": "{n} dibuang",
  "no changes": "tiada perubahan",
  "Menu saved: {parts}.": "Menu disimpan: {parts}.",
};

export default dict;
