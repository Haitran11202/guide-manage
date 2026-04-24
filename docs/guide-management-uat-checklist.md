# Guide Management UAT Checklist

## 1. UAT Scope

Checklist nay dung de nghiem thu thu cong cho module Guide Management hien tai, gom:

- Guide directory
- Guide profile
- Add/Edit guide
- Timeline calendar
- Timeline bookings
- Booking manager
- Assign/confirm/unassign guide
- Busy date, shift, email record

## 2. Preconditions

- Frontend va backend chay duoc va ket noi cung mot data source
- Database da co bang guide, booking, guide busy, assignment, email record
- Co it nhat 3 guide va 2 booking de test case conflict
- SQL da cap nhat version co ho tro cot `Shift` trong `M_GuideBusy`

## 3. UAT Checklist

| ID | Area | Scenario | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| UAT-01 | Guides | Load guide directory | Mo `/guides` | Danh sach guide va filter tags load thanh cong, khong vo layout |
| UAT-02 | Guides | Search by name | Nhap ten guide vao search box | Danh sach loc dung theo guide name |
| UAT-03 | Guides | Filter by status | Chon `Active`, sau do `Inactive` | Danh sach thay doi dung theo status |
| UAT-04 | Guides | Filter by client tags | Chon 1 hoac nhieu tag | Chi hien guide match tag da chon |
| UAT-05 | Guides | Clear filters | Dat search/tag/status roi bam `Clear Filters` | Toan bo filter reset ve mac dinh |
| UAT-06 | Guides | Open profile | Bam `Profile` | Trang profile dung guide duoc mo |
| UAT-07 | Guides | Open schedule | Bam `Schedule` | Dieu huong sang `/timeline?tab=calendar&guideId=...` thanh cong |
| UAT-08 | Add Guide | Open create form | Bam `Add New Guide` | Form tao guide hien thi day du section |
| UAT-09 | Add Guide | Create guide successfully | Nhap thong tin hop le roi `Save Guide` | Guide duoc tao, quay ve danh sach, record moi xuat hien |
| UAT-10 | Add Guide | Country auto-sync from city | Chon city co country mapping | Country tu dong cap nhat theo city |
| UAT-11 | Add Guide | Add multiple language rows | Bam `Add Language`, nhap du lieu | Nhieu dong language duoc luu dung |
| UAT-12 | Add Guide | Add/remove client tags | Nhap tag moi, Enter, sau do xoa 1 tag | Tag duoc them va xoa dung tren form |
| UAT-13 | Edit Guide | Open edit form | Tu profile bam `Edit Profile` | Form edit load dung du lieu guide hien tai |
| UAT-14 | Edit Guide | Update guide | Sua 1 vai field, bam save | Du lieu moi hien thi lai trong directory/profile |
| UAT-15 | Profile | View guide profile | Mo profile cua 1 guide co data | Hien thong tin basic, languages, certs, notes, financial, stats |
| UAT-16 | Timeline Calendar | Load calendar | Mo `/timeline?tab=calendar` | Timeline load guides, bookings, busy dates khong loi |
| UAT-17 | Timeline Calendar | Filter by date range | Doi from/to | Timeline refresh dung theo khoang ngay |
| UAT-18 | Timeline Calendar | Filter by country/client/guide/search | Nhap/chon tung bo loc | Timeline chi hien data phu hop |
| UAT-19 | Timeline Calendar | Open guide detail pane | Double-click guide row | Man detail + busy date management mo dung guide |
| UAT-20 | Busy Dates | Add busy block valid | Nhap `from/to/shift` hop le roi `Add Block` | Busy block moi duoc tao va hien ngay trong danh sach |
| UAT-21 | Busy Dates | Prevent overlap busy block | Tao busy block trung voi block da co | He thong chan thao tac, khong tao duplicate overlap |
| UAT-22 | Busy Dates | Prevent busy block over assigned tour | Chon khoang ngay guide da on-tour | He thong chan thao tac va thong bao conflict |
| UAT-23 | Busy Dates | Remove busy block | Bam icon xoa, xac nhan | Busy block bi xoa va timeline refresh |
| UAT-24 | Timeline Bookings | Load bookings tab | Mo `/timeline?tab=bookings` | Danh sach booking/series load thanh cong |
| UAT-25 | Timeline Bookings | Filter bookings | Dung search, client, country, guide, series filter | Danh sach booking thay doi dung |
| UAT-26 | Timeline Bookings | Load more series | Bam load them tren 1 series nhieu booking | Booking bo sung duoc nap dung series |
| UAT-27 | Booking Manager | Open booking manager | Bam `Manage Booking` tren 1 booking | Board mo dung booking, hien services theo ngay |
| UAT-28 | Booking Manager | Select service items | Chon 1 hoac nhieu service item | Counter selected items tang dung |
| UAT-29 | Assign Guide | Search available guides | Sau khi chon items bam `Assign Guide` | Danh sach guide kha dung hien thi theo availability |
| UAT-30 | Assign Guide | Assign fully free guide | Chon guide fully free va confirm | Guide duoc assign vao cac selected services |
| UAT-31 | Assign Guide | Assign partial-free guide by shift | Chon guide chi ranh mot so shift, chon shift hop le, confirm | Assignment thanh cong chi khi shift hop le |
| UAT-32 | Assign Guide | Prevent assign on conflict | Chon guide dang busy cung ngay/shift | He thong chan assign va thong bao conflict |
| UAT-33 | Assign Guide | Refresh current assignment list | Assign thanh cong | `Currently Assigned` va grid theo ngay duoc refresh dung |
| UAT-34 | Confirm Guide | Confirm assigned guide | Bam `Confirm` tren guide da assign | Trang thai guide chuyen sang confirmed |
| UAT-35 | Confirm Guide | Remove confirmation | Bam action confirm/remove lan nua neu luong cho phep | Trang thai confirmed duoc cap nhat dung |
| UAT-36 | Unassign | Unassign entire guide from booking | Bam `Unassign` tai guide, xac nhan | Guide bi go khoi booking va khoi danh sach assigned |
| UAT-37 | Unassign | Unassign selected items | Chon cac items cung 1 guide roi `Unassign` | Chi cac selected services bi go assign |
| UAT-38 | Unassign | Prevent mixed-guide unassign from selected items | Chon item thuoc nhieu guide khac nhau | Nut/luong unassign selected khong cho phep sai nghiep vu |
| UAT-39 | Time Slot | Change item time slot | Doi time slot/day part cua 1 service item | Time slot moi duoc luu va availability tinh lai dung |
| UAT-40 | Guide Shift | Open shift editor | Bam icon shift editor tren guide da assign | Modal shift load dung cac ngay assignment |
| UAT-41 | Guide Shift | Save valid shifts | Doi shift tung ngay va save | Shift moi duoc luu, reload booking van dung |
| UAT-42 | Guide Shift | Handle missing busy record | Test voi du lieu thieu busy target | He thong tra thong bao loi nghiep vu ro rang |
| UAT-43 | Email Record | Open email composer | Bam `Email` tren assigned guide | Modal email mo voi default subject/body hoac record cu |
| UAT-44 | Email Record | Save draft | Bam `Save Draft` | Record duoc luu, label action hien `draft` |
| UAT-45 | Email Record | Send email record | Bam `Send Email` | Record duoc luu voi status `sent` |
| UAT-46 | API Validation | Invalid shift code | Goi API voi shift khong hop le | Backend tra `400` hoac loi nghiep vu phu hop |
| UAT-47 | API Validation | Missing guide | Goi assign/unassign voi guide khong ton tai | Backend tra `404/400` dung theo API |
| UAT-48 | API Validation | Missing service target | Goi assign voi `resHolidayId` khong ton tai | Backend tra `404` dung contract |
| UAT-49 | Regression | Back/close booking manager | Dong modal/board sau thao tac | UI quay lai trang truoc, state khong bi vo |
| UAT-50 | Regression | Refresh after chained actions | Thuc hien assign -> confirm -> email -> unassign | Timeline/bookings data van dong bo, khong stale data |

## 4. High Priority Negative Tests

- Assign 1 guide vao 2 booking conflict cung ngay va cung shift
- Them busy date overlap voi chinh busy date cu
- Sua shift sang gia tri khong hop le
- Unassign selected items khi selection gom nhieu guide khac nhau
- Confirm guide chua duoc assign
- Save guide voi city/country mismatch

## 5. UAT Sign-off Template

| Item | Value |
| --- | --- |
| Tester | |
| Environment | |
| Build version | |
| Test date | |
| Passed cases | |
| Failed cases | |
| Blocking issues | |
| Sign-off decision | Pass / Conditional Pass / Fail |

## 6. Notes

- Neu can nghiem thu theo sprint, co the tach bang tren thanh 3 nhom: `Guide Master`, `Calendar`, `Bookings & Assignment`.
- Nen uu tien chay `UAT-20` den `UAT-45` sau khi da xac nhan SQL shift script da duoc ap dung.
