import { NextFunction, Request, Response } from "express";
import { TryCatch } from "../middlewares/error.js";
import {
  BaseQuery,
  NewProductRequestBody,
  SearchRequestQuery,
} from "../types/types.js";
import { Product } from "../models/products.js";
import ErrorHandler from "../utils/utility-class.js";
import { rm } from "fs";
import { myCache } from "../app.js";
import { invalidateCache } from "../utils/features.js";

// Revalidate on New, Update, Delete product & on New Order
export const getLatestProducts = TryCatch(async (req, res, next) => {
  const products = await Product.find({}).sort({ createdAt: -1 }).limit(5);

  return res.status(200).json({
    success: true,
    products,
  });
});


// Revalidate on New, Update, Delete product & on New Order
export const getAllCategories = TryCatch(async (req, res, next) => {
  let categories;

  if (myCache.has("categories")) {
    categories = JSON.parse(myCache.get("categories") as string);
  } else {
    categories = await Product.distinct("category");
    myCache.set("categories", JSON.stringify(categories));
  }

  return res.status(200).json({
    success: true,
    categories,
  });
});

// Revalidate on New, Update, Delete product & on New Order
export const getAdminProducts = TryCatch(async (req, res, next) => {
  let products;

  if (myCache.has("all-products")) {
    products = JSON.parse(myCache.get("all-products") as string);
  } else {
    products = await Product.find({});
    myCache.set("all-products", JSON.stringify(products));
  }

  return res.status(200).json({
    success: true,
    products,
  });
});

export const getSingleProduct = TryCatch(async (req, res, next) => {
  let product;
  const id = req.params.id;

  if (myCache.has(`product-${id}`)) {
    product = JSON.parse(myCache.get(`product-${id}`) as string);
  } else {
    product = await Product.findById(id);

    if (!product) return next(new ErrorHandler("Product Not Found", 404));

    myCache.set(`product-${id}`, JSON.stringify(product));
  }

  return res.status(200).json({
    success: true,
    product,
  });
});

export const newProduct = TryCatch(
  async (
    req: Request<{}, {}, NewProductRequestBody>,
    res: Response,
    next: NextFunction
  ) => {
    const { name, price, stock, category } = req.body;

    const photo = req.file;

    if (!photo) return next(new ErrorHandler("Please add Photo", 400));

    if (!name || !price || !stock || !category) {
      rm(photo.path, () => {
        console.log("Deleted");
      });
      return next(new ErrorHandler("Please enter All Fields", 400));
    }

    await Product.create({
      name,
      price,
      stock,
      category: category.toLocaleLowerCase(),
      photo: photo?.path,
    });

    invalidateCache({ product: true, admin: true });

    return res.status(201).json({
      success: true,
      message: "Product Created Successfully",
    });
  }
);

export const updateProduct = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const { name, price, stock, category } = req.body;
  const photo = req.file;
  const product = await Product.findById(id);

  if (!product) return next(new ErrorHandler("Product Not Found", 404));

  if (photo) {
    rm(product.photo!, () => {
      console.log("Old Photo Deleted");
    });

    product.photo = photo.path;
  }

  if (name) product.name = name;
  if (price) product.price = price;
  if (stock) product.stock = stock;
  if (category) product.category = category;

  await product.save();

  invalidateCache({
    product: true,
    productId: String(product._id),
    admin: true,
  });

  return res.status(200).json({
    success: true,
    message: "Product Updated Successfully",
  });
});

export const deleteProduct = TryCatch(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) return next(new ErrorHandler("Product Not Found", 404));

  rm(product.photo!, () => {
    console.log("Product Photo Deleted");
  });

  await product.deleteOne();

  invalidateCache({
    product: true,
    productId: String(product._id),
    admin: true,
  });

  return res.status(200).json({
    success: true,
    message: "Product Deleted Successfully",
  });
});

export const getAllProducts = TryCatch(
  async (req: Request<{}, {}, {}, SearchRequestQuery>, res, next) => {
    const { search, category, price, sort } = req.query;

    const page = Number(req.query.page) || 1;

    const limit = Number(process.env.PRODUCT_PER_PAGE) || 8;
    const skip = (page - 1) * limit;
    // page:1=>products: 1,2,3,4,5,6,7,8
    // page:2=>products: 9,10,11,12,13,14,15,16 (first 8 skips)
    // page:3=>products: 17,18,19,20,21,22,23,24 (first 16 skips)

    const baseQuery: BaseQuery = {};

    if (search)
      baseQuery.name = {
        $regex: search,
        $options: "i",
      };

    if (price)
      baseQuery.price = {
        $lte: Number(price),
      };

    if (category) baseQuery.category = category;

    const productsPromise = Product.find(baseQuery)
      .sort(sort && { price: sort === "asc" ? 1 : -1 })
      .limit(limit)
      .skip(skip);

    const [products, filteredOnlyProduct] = await Promise.all([
      productsPromise,
      Product.find(baseQuery),
    ]);

    const totalPage = Math.ceil(filteredOnlyProduct.length / limit);

    return res.status(200).json({
      success: true,
      products,
      totalPage,
    });
  }
);
