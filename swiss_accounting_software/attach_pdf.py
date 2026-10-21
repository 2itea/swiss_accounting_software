import frappe
from frappe import _
from PyPDF4 import PdfFileMerger
from frappe.utils.file_manager import save_file
from io import BytesIO

from swiss_accounting_software.qr_bill import generate_qr_slip_pdfs


def save_and_attach(content, to_doctype, to_name):
	file_name = filename(to_name)
	save_file(file_name, content, to_doctype, to_name, is_private=1)


def get_pdf_data(doctype, name):
	language = frappe.db.get_value(doctype, name, "language", ignore=True)
	_lang = frappe.local.lang
	frappe.local.lang = language if language else _lang
	try:
		html = frappe.get_print(doctype, name)
		return frappe.utils.pdf.get_pdf(html)
	finally:
		frappe.local.lang = _lang


def filename(docname):
	return "{}-QR.pdf".format(docname)


def merge_pdf(pdf_list):
	merger = PdfFileMerger()

	for pdf in pdf_list:
		merger.append(pdf)

	output = BytesIO()
	merger.write(output)
	merger.close()

	return output.getvalue()


def remove_existing_qr_pdf(doctype, docname):
	prefix = filename(docname).rsplit(".", 1)[0]
	files = frappe.get_all(
		"File",
		filters={
			"attached_to_doctype": doctype,
			"attached_to_name": docname,
		},
		fields=["name", "file_name"],
	)
	for file in files:
		if file.file_name and file.file_name.startswith(prefix):
			frappe.delete_doc("File", file.name, ignore_permissions=True)


def sales_invoice_before_submit(doc, method=None):
	set_payment_reference(doc)


def set_payment_reference(doc):
	from swiss_accounting_software.qr_bill import get_payment_reference

	reference = get_payment_reference(doc)
	values = {"esr_reference_code": reference}
	if reference and reference.startswith("RF"):
		values["reference_number_full"] = reference
		values["reference_number"] = " ".join(reference[i : i + 4] for i in range(0, len(reference), 4))

	values = {field: value for field, value in values.items() if doc.meta.has_field(field)}
	if doc.docstatus == 1:
		doc.db_set(values)
	else:
		doc.update(values)


def sales_invoice_on_submit(doc, method=None):
	if not should_create_qr_on_submit(doc.company):
		return
	attach_qr_bill(doc.name, ignore_permissions=True)


def should_create_qr_on_submit(company):
	if not company or not frappe.db.exists("Swiss QR Bill Settings", company):
		return False
	return bool(frappe.db.get_value("Swiss QR Bill Settings", company, "si_qr_on_submit"))


def attach_qr_bill(docname, ignore_permissions=False):
	doctype = "Sales Invoice"
	invoice = frappe.get_doc(doctype, docname)
	if not ignore_permissions:
		invoice.check_permission("read")

	# Store the reference before printing it, so the QR and bank matching use the same one.
	if not invoice.esr_reference_code:
		set_payment_reference(invoice)

	qr_pdfs = generate_qr_slip_pdfs(invoice)
	invoice_pdf = get_pdf_data(doctype, docname)
	merged_pdf = merge_pdf([BytesIO(invoice_pdf), *[BytesIO(pdf) for pdf in qr_pdfs]])

	remove_existing_qr_pdf(doctype, docname)
	save_and_attach(merged_pdf, doctype, docname)


@frappe.whitelist()
def attach_pdf(docname=None, **kwargs):
	docname = docname or kwargs.get("docname")
	if not docname:
		frappe.throw(_("Sales Invoice name is required"))

	attach_qr_bill(docname)
